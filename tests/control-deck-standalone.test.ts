import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { ControlDeckApplication } from '../apps/control-deck/src/control-deck-application.js'

test('standalone Control Deck mounts the shared pairing host', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'control-deck-'))
  const application = new ControlDeckApplication({ dataDirectory: directory, host: '127.0.0.1', port: 0 })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
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

    const catalogue = await fetch(`${baseUrl}/api/commands`, { headers: { cookie: cookie! } })
    expect(await catalogue.json()).toMatchObject({
      adapters: [{ id: 'builtin.keyboard', available: true, simulated: true }]
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
    expect(application.keyboardOutput.getRecordedInputs().map(input => input.operation)).toEqual([
      'tap',
      'press',
      'release'
    ])
  } finally {
    await application.stop()
    rmSync(directory, { force: true, recursive: true })
  }
})
