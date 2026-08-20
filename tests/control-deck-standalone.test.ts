import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { RecordingKeyboardOutput } from '@jdu/control-deck-adapter-keyboard'
import { ControlDeckApplication } from '../apps/control-deck/src/control-deck-application.js'

test('standalone Control Deck mounts the shared pairing host', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'control-deck-'))
  const webDirectory = join(directory, 'web')
  mkdirSync(join(webDirectory, 'assets'), { recursive: true })
  writeFileSync(join(webDirectory, 'index.html'), '<main>Control Deck client</main>')
  writeFileSync(join(webDirectory, 'assets', 'client.js'), 'globalThis.controlDeck = true')
  const keyboardOutput = new RecordingKeyboardOutput()
  const application = new ControlDeckApplication({
    dataDirectory: directory,
    host: '127.0.0.1',
    port: 0,
    webDirectory,
    keyboardOutput
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const root = await fetch(baseUrl)
    expect(root.status).toBe(200)
    expect(root.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await root.text()).toContain('Control Deck client')
    expect(await (await fetch(`${baseUrl}/decks/desktop`)).text()).toContain('Control Deck client')
    const asset = await fetch(`${baseUrl}/assets/client.js`)
    expect(asset.headers.get('cache-control')).toContain('immutable')
    expect(await asset.text()).toContain('controlDeck')
    expect((await fetch(`${baseUrl}/%2e%2e/pairing.json`)).status).toBe(404)
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(401)
    expect((await fetch(`${baseUrl}/api/commands`)).status).toBe(401)
    expect((await fetch(`${baseUrl}/api/configuration`)).status).toBe(401)
    const claim = await fetch(`${baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code: application.pairing.pairingCode }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(claim.status).toBe(200)
    const cookie = claim.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toMatch(/^control_deck_session=/)
    expect((await fetch(`${baseUrl}/api/health`, { headers: { cookie: cookie! } })).status).toBe(200)

    const configuration = await fetch(`${baseUrl}/api/configuration`, { headers: { cookie: cookie! } })
    expect(await configuration.json()).toEqual({ version: 1, decks: [], displays: [] })
    const invalidConfiguration = await fetch(`${baseUrl}/api/configuration`, {
      body: JSON.stringify({
        version: 1,
        decks: [{
          id: 'invalid',
          name: 'Invalid',
          description: '',
          context: null,
          layout: { kind: 'grid', columns: 0, rows: 2 },
          elements: []
        }],
        displays: []
      }),
      headers: { cookie: cookie!, 'content-type': 'application/json' },
      method: 'PUT'
    })
    expect(invalidConfiguration.status).toBe(400)
    expect(await invalidConfiguration.json()).toEqual({
      error: { code: 'deck_configuration_invalid', message: 'Too small: expected number to be >=1' }
    })
    const savedConfiguration = await fetch(`${baseUrl}/api/configuration`, {
      body: JSON.stringify({
        version: 1,
        decks: [{
          id: 'desktop',
          name: 'Desktop',
          description: '',
          context: null,
          layout: { kind: 'grid', columns: 4, rows: 2 },
          elements: []
        }],
        displays: [{ id: 'tablet', name: 'Tablet', deckId: 'desktop', order: 0 }]
      }),
      headers: { cookie: cookie!, 'content-type': 'application/json' },
      method: 'PUT'
    })
    expect(savedConfiguration.status).toBe(200)
    expect(await savedConfiguration.json()).toMatchObject({
      decks: [{ id: 'desktop' }],
      displays: [{ id: 'tablet', deckId: 'desktop' }]
    })

    const savedMacro = await fetch(`${baseUrl}/api/macros`, {
      body: JSON.stringify({
        version: 1,
        id: 'double_key',
        name: 'Double key',
        description: '',
        enabled: true,
        steps: [
          { type: 'command', target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'A', modifiers: [] } }, operation: 'tap' },
          { type: 'wait', durationMs: 1 },
          { type: 'command', target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'B', modifiers: [] } }, operation: 'tap' }
        ]
      }),
      headers: { cookie: cookie!, 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(savedMacro.status).toBe(200)
    expect(await savedMacro.json()).toMatchObject({ id: 'double_key', steps: [{ type: 'command' }, { type: 'wait' }, { type: 'command' }] })
    expect(await (await fetch(`${baseUrl}/api/macros`, { headers: { cookie: cookie! } })).json()).toMatchObject({
      macros: [{ id: 'double_key' }]
    })

    const catalogue = await fetch(`${baseUrl}/api/commands`, { headers: { cookie: cookie! } })
    expect(await catalogue.json()).toMatchObject({
      adapters: [
        { id: 'builtin.keyboard', available: true, simulated: true },
        { id: 'builtin.macro', commands: [{ id: 'double_key', simulated: true }] }
      ]
    })

    const execute = async (operation: 'tap' | 'press' | 'release', leaseId?: string) => {
      const response = await fetch(`${baseUrl}/api/commands/execute`, {
        body: JSON.stringify({
          target: {
            adapterId: 'builtin.keyboard',
            commandId: 'key',
            configuration: { key: 'Space', modifiers: ['Control'] }
          },
          operation,
          ...(leaseId ? { leaseId } : {})
        }),
        headers: {
          cookie: cookie!,
          'content-type': 'application/json'
        },
        method: 'POST'
      })
      expect(response.status).toBe(200)
      return response.json()
    }

    expect(await execute('tap')).toMatchObject({ status: 'accepted', simulated: true })
    expect(await execute('press', 'hold-1')).toMatchObject({ status: 'accepted' })
    expect(await execute('press', 'hold-1')).toMatchObject({ message: 'Hold lease renewed.' })
    expect(await execute('release', 'hold-1')).toMatchObject({ status: 'accepted' })
    const macroExecution = await fetch(`${baseUrl}/api/commands/execute`, {
      body: JSON.stringify({
        target: { adapterId: 'builtin.macro', commandId: 'double_key', configuration: {} },
        operation: 'tap'
      }),
      headers: { cookie: cookie!, 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(macroExecution.status).toBe(200)
    expect(await macroExecution.json()).toMatchObject({ status: 'accepted', simulated: true })
    expect(keyboardOutput.getRecordedInputs().map(input => input.operation)).toEqual([
      'tap',
      'press',
      'release',
      'tap',
      'tap'
    ])
  } finally {
    await application.stop()
    rmSync(directory, { force: true, recursive: true })
  }
})
