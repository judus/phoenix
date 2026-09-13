import { expect, test } from 'vitest'
import type { CommunicationMessage, CommunicationsResponse } from '@phoenix/contracts'
import { CommunicationDataService } from '../apps/server/src/application/communication-data-service.js'
import type { CommunicationQueryView, CommunicationRepository } from '../apps/server/src/domain/communications.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('communications separate private inbox messages from public and NPC traffic', () => {
  const service = new CommunicationDataService(new MemoryCommunicationRepository())
  service.ingest({ timestamp: '2026-08-15T08:00:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'Form up.', Channel: 'wing' })
  service.ingest({ timestamp: '2026-08-15T08:01:00Z', event: 'ReceiveText', From: 'CMDR Turing', Message: 'o7', Channel: 'starsystem' })
  service.ingest({ timestamp: '2026-08-15T08:02:00Z', event: 'ReceiveText', From: '$npc_name;', From_Localised: 'Pirate', Message: '$npc_line;', Message_Localised: 'Hand over your cargo.', Channel: 'npc' })

  expect(service.getCommunications('inbox')).toMatchObject({
    messages: [{ sender: 'CMDR Ada', senderKind: 'commander', view: 'inbox' }],
    summary: { inbound: 1, inbox: 1, outbound: 0, traffic: 2, total: 1 }
  })
  expect(service.getCommunications('traffic')).toMatchObject({
    messages: [
      { message: 'Hand over your cargo.', rawMessage: '$npc_line;', sender: 'Pirate', senderKind: 'npc' },
      { sender: 'CMDR Turing', senderKind: 'commander' }
    ],
    summary: { inbound: 2, inbox: 1, outbound: 0, traffic: 2, total: 2 }
  })
})

test('contacts are explicitly derived from observed commander correspondents', () => {
  const service = new CommunicationDataService(new MemoryCommunicationRepository())
  service.ingest({ timestamp: '2026-08-15T08:00:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'First', Channel: 'friend' })
  service.ingest({ timestamp: '2026-08-15T08:05:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'Second', Channel: 'starsystem' })
  service.ingest({ timestamp: '2026-08-15T08:06:00Z', event: 'ReceiveText', From: 'Station Control', Message: 'Welcome', Channel: 'npc' })

  expect(service.getCommunications().contacts).toEqual([{
    channels: ['friend', 'starsystem'],
    id: 'cmdr ada',
    inboundCount: 2,
    lastMessage: 'Second',
    lastSeenAt: '2026-08-15T08:05:00Z',
    name: 'CMDR Ada',
    outboundCount: 0
  }])
})

test('direct outgoing messages belong to the inbox and contribute correspondent evidence', () => {
  const service = new CommunicationDataService(new MemoryCommunicationRepository())
  service.ingest({ timestamp: '2026-08-15T08:00:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'Form up.', Channel: 'player' })
  service.ingest({ timestamp: '2026-08-15T08:01:00Z', event: 'SendText', To: 'CMDR Ada', Message: 'On my way.' })
  service.ingest({ timestamp: '2026-08-15T08:02:00Z', event: 'SendText', To: 'wing', Message: 'Ready.' })

  expect(service.getCommunications('inbox')).toMatchObject({
    messages: [
      { channel: 'wing', recipient: 'wing', view: 'inbox' },
      { channel: 'player', recipient: 'CMDR Ada', view: 'inbox' },
      { channel: 'player', sender: 'CMDR Ada', view: 'inbox' }
    ],
    summary: { inbound: 1, outbound: 2, total: 3 }
  })
  expect(service.getCommunications().contacts).toEqual([{
    channels: ['player'],
    id: 'cmdr ada',
    inboundCount: 1,
    lastMessage: 'On my way.',
    lastSeenAt: '2026-08-15T08:01:00Z',
    name: 'CMDR Ada',
    outboundCount: 1
  }])
})

test('SQLite communication projection is idempotent across replay', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new CommunicationDataService(database)
    const traffic = { timestamp: '2026-08-15T08:00:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'o7', Channel: 'starsystem' }
    service.ingest(traffic)
    service.ingest(traffic)
    service.ingest({ timestamp: '2026-08-15T08:01:00Z', event: 'ReceiveText', From: 'CMDR Turing', Message: 'Form up.', Channel: 'wing' })

    expect(service.getCommunications()).toMatchObject({ summary: { inbox: 1, total: 2, traffic: 1 } })
    expect(service.getCommunications('inbox')).toMatchObject({
      summary: { inbound: 1, inbox: 1, outbound: 0, total: 1, traffic: 1 }
    })
    expect(service.getCommunications('traffic')).toMatchObject({
      summary: { inbound: 1, inbox: 1, outbound: 0, total: 1, traffic: 1 }
    })
  } finally {
    database.close()
  }
})

class MemoryCommunicationRepository implements CommunicationRepository {
  private readonly messages = new Map<string, CommunicationMessage>()

  public listCommunicationMessages (view: CommunicationQueryView, limit: number): CommunicationMessage[] {
    return [...this.messages.values()]
      .filter(message => view === 'all' || message.view === view)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit)
  }

  public putCommunicationMessage (message: CommunicationMessage): void { this.messages.set(message.id, structuredClone(message)) }

  public summarizeCommunications (view: CommunicationQueryView): CommunicationsResponse['summary'] {
    const messages = [...this.messages.values()]
    const selected = messages.filter(message => view === 'all' || message.view === view)
    return {
      inbound: selected.filter(message => message.direction === 'inbound').length,
      inbox: messages.filter(message => message.view === 'inbox').length,
      outbound: selected.filter(message => message.direction === 'outbound').length,
      total: selected.length,
      traffic: messages.filter(message => message.view === 'traffic').length
    }
  }
}
