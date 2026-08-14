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
    summary: { inbox: 1, traffic: 2, total: 3 }
  })
  expect(service.getCommunications('traffic').messages).toMatchObject([
    { message: 'Hand over your cargo.', rawMessage: '$npc_line;', sender: 'Pirate', senderKind: 'npc' },
    { sender: 'CMDR Turing', senderKind: 'commander' }
  ])
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

test('SQLite communication projection is idempotent across replay', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new CommunicationDataService(database)
    const event = { timestamp: '2026-08-15T08:00:00Z', event: 'ReceiveText', From: 'CMDR Ada', Message: 'o7', Channel: 'starsystem' }
    service.ingest(event)
    service.ingest(event)
    expect(service.getCommunications()).toMatchObject({ summary: { total: 1, traffic: 1 } })
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

  public summarizeCommunications (): CommunicationsResponse['summary'] {
    const messages = [...this.messages.values()]
    return {
      inbound: messages.filter(message => message.direction === 'inbound').length,
      inbox: messages.filter(message => message.view === 'inbox').length,
      outbound: messages.filter(message => message.direction === 'outbound').length,
      total: messages.length,
      traffic: messages.filter(message => message.view === 'traffic').length
    }
  }
}
