import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { StaticGameActionBindingResolver } from '../apps/server/src/infrastructure/static-game-action-binding-resolver.js'
import { RecordingInputBackend } from '../apps/server/src/infrastructure/recording-input-backend.js'

test('a browser records, saves, discovers, and plays a semantic macro', async () => {
  const inputBackend = new RecordingInputBackend()
  const application = new PhoenixApplication({
    actionBindingResolver: new StaticGameActionBindingResolver(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    inputBackend,
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const recording = await client.startMacroRecording('tablet-one')
    const updated = await client.recordMacroCommand(
      recording.id,
      'tablet-one',
      'command.elite.ShipSpotLightToggle'
    )
    expect(updated.entries).toHaveLength(1)
    expect(updated.entries[0]?.delayBeforeMs).toBe(0)
    const draft = await client.stopMacroRecording(recording.id, 'tablet-one')
    expect(draft.status).toBe('stopped')

    await client.saveMacro({
      assumptions: ['Cockpit has focus'],
      description: 'Recorded test sequence',
      enabled: true,
      id: 'test-lights',
      name: 'Test lights',
      risk: 'safe',
      steps: [{ type: 'command', commandId: 'command.elite.ShipSpotLightToggle', operation: 'tap' }],
      version: 2
    })

    expect((await client.getMacros()).macros).toHaveLength(1)
    const result = await client.playMacro('test-lights')
    expect(result).toMatchObject({ status: 'completed', macroId: 'test-lights' })
    expect(inputBackend.getRecordedInputs()).toHaveLength(2)
  } finally {
    await application.stop()
  }
})

test('recording ownership prevents another browser contaminating a draft', async () => {
  const application = new PhoenixApplication({
    actionBindingResolver: new StaticGameActionBindingResolver(),
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    inputBackend: new RecordingInputBackend(),
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const recording = await client.startMacroRecording('tablet-one')
    await expect(client.recordMacroCommand(
      recording.id,
      'tablet-two',
      'command.elite.ShipSpotLightToggle'
    )).rejects.toThrow('Macro recording session is unavailable')
  } finally {
    await application.stop()
  }
})
