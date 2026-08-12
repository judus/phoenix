import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('a browser pairs once and then accesses protected PHOENIX APIs with its session cookie', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-pairing-'))
  const accessControl = new PairingAccessController(join(directory, 'pairing.json'))
  const application = new PhoenixApplication({
    accessControl,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const status = await fetch(`${baseUrl}/api/pairing/status`)
    expect(await status.json()).toMatchObject({ authenticated: false, pairingRequired: true })

    const rejected = await fetch(`${baseUrl}/api/health`)
    expect(rejected.status).toBe(401)

    const claim = await fetch(`${baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code: accessControl.pairingCode.toLowerCase().replace('-', ' ') }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    expect(claim.status).toBe(200)
    const cookie = claim.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toMatch(/^phoenix_session=/)

    const accepted = await fetch(`${baseUrl}/api/health`, { headers: { cookie: cookie! } })
    expect(accepted.status).toBe(200)
  } finally {
    await application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the installation bearer token authenticates non-browser clients', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-pairing-'))
  const accessControl = new PairingAccessController(join(directory, 'pairing.json'))
  const application = new PhoenixApplication({
    accessControl,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()

  try {
    const response = await fetch(`http://${address.host}:${address.port}/api/health`, {
      headers: { authorization: `Bearer ${accessControl.bearerToken}` }
    })
    expect(response.status).toBe(200)
  } finally {
    await application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
