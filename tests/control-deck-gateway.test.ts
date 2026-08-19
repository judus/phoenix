import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'

test('the LAN gateway exposes only paired Control Deck capabilities', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-control-deck-'))
  const access = new PairingAccessController(join(directory, 'pairing.json'))
  const input = new RecordingInputBackend()
  const application = new PhoenixApplication({
    accessControl: access,
    actionBindingResolver: new StaticGameActionBindingResolver(),
    controlDeckGateway: { host: '127.0.0.1', port: 0 },
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    inputBackend: input,
    port: 0
  })

  try {
    await application.start()
    const address = application.getControlDeckGatewayAddress()!
    const baseUrl = `http://${address.host}:${address.port}`
    const authorization = { authorization: `Bearer ${access.bearerToken}` }

    expect((await fetch(`${baseUrl}/api/commands`)).status).toBe(401)
    const catalogue = await fetch(`${baseUrl}/api/commands`, { headers: authorization })
    expect(catalogue.status).toBe(200)
    expect(await catalogue.json()).toMatchObject({ commands: expect.arrayContaining([
      expect.objectContaining({ id: 'command.elite.ShipSpotLightToggle' })
    ]) })

    const execution = await fetch(`${baseUrl}/api/commands/execute`, {
      body: JSON.stringify({ commandId: 'command.elite.ShipSpotLightToggle', operation: 'tap' }),
      headers: { ...authorization, 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(execution.status).toBe(200)
    expect(await execution.json()).toMatchObject({ commandId: 'command.elite.ShipSpotLightToggle', status: 'accepted' })
    expect(input.getRecordedInputs()).toHaveLength(1)

    expect((await fetch(`${baseUrl}/api/runtime-state`, { headers: authorization })).status).toBe(404)
    expect((await fetch(`${baseUrl}/mcp`, { headers: authorization })).status).toBe(404)
  } finally {
    await application.stop()
    rmSync(directory, { force: true, recursive: true })
  }
})
