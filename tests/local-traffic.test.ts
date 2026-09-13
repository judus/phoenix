import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { CommunicationMessage, CommunicationsResponse } from '@phoenix/contracts'
import { LocalTrafficService } from '../apps/server/src/application/local-traffic-service.js'
import type { CommunicationQueryView, CommunicationRepository } from '../apps/server/src/domain/communications.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('Local Traffic keeps personal communication visible and collapses repeated ambient chatter', () => {
  const repository = new MemoryCommunicationRepository([
    message('ambient-new', '2026-09-13T09:59:00Z', { message: 'Maintain speed.', sender: 'Station Control', senderKind: 'npc' }),
    message('ambient-repeat', '2026-09-13T09:58:00Z', { message: 'Maintain speed.', sender: 'Station Control', senderKind: 'npc' }),
    message('ambient-other', '2026-09-13T09:57:00Z', { message: 'Docking request granted.', sender: 'Flight Control', senderKind: 'npc' }),
    message('public-commander', '2026-09-13T09:40:00Z', { message: 'o7', sender: 'CMDR Turing', senderKind: 'commander' }),
    message('direct', '2026-09-13T09:35:00Z', { channel: 'player', message: 'Form up.', sender: 'CMDR Ada', senderKind: 'commander', view: 'inbox' }),
    message('stale', '2026-09-13T08:00:00Z', { channel: 'wing', message: 'Old message', sender: 'CMDR Grace', senderKind: 'commander', view: 'inbox' })
  ])
  const service = new LocalTrafficService(repository, () => new Date('2026-09-13T10:00:00Z'))

  expect(service.getLocalTraffic(3)).toEqual({
    generatedAt: '2026-09-13T10:00:00.000Z',
    messages: [
      expect.objectContaining({ id: 'ambient-new' }),
      expect.objectContaining({ id: 'public-commander' }),
      expect.objectContaining({ id: 'direct' })
    ],
    schemaVersion: 1,
    windowMinutes: 90
  })
  expect(service.getLocalTraffic(12).messages.map(entry => entry.id)).toEqual([
    'ambient-new',
    'ambient-other',
    'public-commander',
    'direct'
  ])
})

test('Local Traffic reports an honest quiet snapshot when no recent communication exists', () => {
  const repository = new MemoryCommunicationRepository([
    message('stale', '2026-09-13T08:00:00Z', { message: 'Old traffic' })
  ])
  const service = new LocalTrafficService(repository, () => new Date('2026-09-13T10:00:00Z'))

  expect(service.getLocalTraffic()).toMatchObject({ messages: [], schemaVersion: 1, windowMinutes: 90 })
})

test('Local Traffic is populated through the journal pipeline and canonical API', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-local-traffic-'))
  const timestamp = new Date().toISOString()
  writeFileSync(join(eliteDirectory, 'Journal.2026-09-13T200000.01.log'), `${JSON.stringify({
    timestamp,
    event: 'ReceiveText',
    From: 'CMDR Ada',
    Message: 'o7',
    Channel: 'starsystem'
  })}\n`)
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory,
    host: '127.0.0.1',
    port: 0
  })

  try {
    const address = await application.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    await expect(client.getLocalTraffic()).resolves.toMatchObject({
      messages: [expect.objectContaining({ message: 'o7', sender: 'CMDR Ada', senderKind: 'commander' })],
      schemaVersion: 1,
      windowMinutes: 90
    })
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})

function message (
  id: string,
  timestamp: string,
  overrides: Partial<CommunicationMessage>
): CommunicationMessage {
  return {
    channel: 'npc',
    direction: 'inbound',
    id,
    message: 'Traffic message',
    rawMessage: null,
    rawSender: null,
    recipient: null,
    sender: 'Local contact',
    senderKind: 'npc',
    sourceEvent: 'ReceiveText',
    timestamp,
    view: 'traffic',
    ...overrides
  }
}

class MemoryCommunicationRepository implements CommunicationRepository {
  public constructor (private readonly messages: CommunicationMessage[]) {}

  public listCommunicationMessages (view: CommunicationQueryView, limit: number): CommunicationMessage[] {
    return this.messages
      .filter(message => view === 'all' || message.view === view)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit)
  }

  public putCommunicationMessage (message: CommunicationMessage): void {
    this.messages.push(message)
  }

  public summarizeCommunications (_view: CommunicationQueryView): CommunicationsResponse['summary'] {
    return { inbound: 0, inbox: 0, outbound: 0, total: 0, traffic: 0 }
  }
}
