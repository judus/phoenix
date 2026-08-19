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
    const claim = await fetch(`${baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code: application.pairing.pairingCode }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(claim.status).toBe(200)
    const cookie = claim.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toMatch(/^control_deck_session=/)
    expect((await fetch(`${baseUrl}/api/health`, { headers: { cookie: cookie! } })).status).toBe(200)
  } finally {
    await application.stop()
    rmSync(directory, { force: true, recursive: true })
  }
})
