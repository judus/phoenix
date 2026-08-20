import { ControlDeckConfigurationSchema, type ControlDeckCommandTarget } from '@jdu/control-deck-core'
import { expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { PhoenixControlDeckClient } from '../apps/web/src/features/controls/phoenix-control-deck-client.js'

test('the PHOENIX host adapter delegates the complete Control Deck client contract', async () => {
  const configuration = ControlDeckConfigurationSchema.parse({ version: 1, decks: [], displays: [] })
  const catalogue = { adapters: [] }
  const target: ControlDeckCommandTarget = { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'L' } }
  const result = {
    requestId: 'request', correlationId: 'request', target, operation: 'tap' as const,
    ownerKey: 'owner', status: 'accepted' as const, timestamp: '2026-08-20T12:00:00.000Z',
    message: 'Accepted.', simulated: false
  }
  const api = {
    getControlDeckCommands: vi.fn(async () => catalogue),
    getControlDeckConfiguration: vi.fn(async () => configuration),
    saveControlDeckConfiguration: vi.fn(async candidate => candidate),
    executeControlDeckCommand: vi.fn(async () => result)
  } as unknown as PhoenixApi
  const client = new PhoenixControlDeckClient(api)

  await expect(client.commands()).resolves.toBe(catalogue)
  await expect(client.configuration()).resolves.toBe(configuration)
  await expect(client.saveConfiguration(configuration)).resolves.toBe(configuration)
  await expect(client.execute(target, 'tap', 'lease')).resolves.toBe(result)
  expect(api.executeControlDeckCommand).toHaveBeenCalledWith(target, 'tap', 'lease')
})
