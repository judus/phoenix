import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('browser pairing sessions authorize independently and can be revoked per device', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-pairing-'))
  const credentialsFile = join(directory, 'pairing.json')
  const accessControl = new PairingAccessController(credentialsFile)
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
    expect(await status.json()).toMatchObject({ authenticated: false, pairingRequired: true, serverDevice: true })

    const pairingInfo = await fetch(`${baseUrl}/api/pairing/info`)
    expect(pairingInfo.status).toBe(200)
    expect(await pairingInfo.json()).toMatchObject({
      access: [],
      installationId: accessControl.installationId,
      pairingCode: accessControl.pairingCode,
      serverDevice: true
    })

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

    const secondClaim = await fetch(`${baseUrl}/api/pairing/claim`, {
      body: JSON.stringify({ code: accessControl.pairingCode }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    const secondCookie = secondClaim.headers.get('set-cookie')?.split(';')[0]
    expect(secondCookie).toMatch(/^phoenix_session=/)
    expect(secondCookie).not.toBe(cookie)
    const restarted = new PairingAccessController(credentialsFile)
    expect(restarted.isAuthorized(requestWithCookie(secondCookie!))).toBe(true)
    expect(readFileSync(credentialsFile, 'utf8')).not.toContain(secondCookie!.split('=')[1]!)

    const released = await fetch(`${baseUrl}/api/pairing/release`, {
      headers: { cookie: cookie! },
      method: 'POST'
    })
    expect(released.status).toBe(200)
    expect((await fetch(`${baseUrl}/api/health`, { headers: { cookie: cookie! } })).status).toBe(401)
    expect((await fetch(`${baseUrl}/api/health`, { headers: { cookie: secondCookie! } })).status).toBe(200)
  } finally {
    await application.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

function requestWithCookie (cookie: string): IncomingMessage {
  return { headers: { cookie } } as IncomingMessage
}

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
