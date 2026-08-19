import { expect, test } from 'vitest'
import { PairingAccessController, satelliteAccessUrls, type PairingCredentials } from '@phoenix/control-deck/host'

test('QR-ready pairing challenges are short-lived, one-time, and create revocable device sessions', () => {
  let persisted: PairingCredentials | undefined
  let now = Date.parse('2026-08-19T12:00:00.000Z')
  const access = new PairingAccessController({
    load: () => persisted,
    save: credentials => { persisted = structuredClone(credentials) }
  }, { challengeLifetimeMs: 1_000, now: () => now })

  const first = access.createPairingChallenge('http://192.168.1.20:3402/')
  expect(first.pairingUrl).toContain('pairingChallenge=cdp_')
  expect(access.claim(first.challenge, 'Kitchen tablet')).toBeTruthy()
  expect(access.claim(first.challenge, 'Replay')).toBeNull()
  expect(access.listSessions()).toEqual([expect.objectContaining({ name: 'Kitchen tablet' })])

  const sessionId = access.listSessions()[0]!.id
  expect(access.revokeSession(sessionId)).toBe(true)
  expect(access.listSessions()).toEqual([])

  const expired = access.createPairingChallenge('http://192.168.1.20:3402/')
  now += 1_001
  expect(access.claim(expired.challenge)).toBeNull()
})

test('wildcard listeners advertise concrete LAN addresses', () => {
  expect(satelliteAccessUrls({ host: '0.0.0.0', port: 3402 }, {
    ethernet: [{ address: '192.168.1.20', family: 'IPv4', internal: false } as never],
    loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as never]
  })).toEqual(['http://192.168.1.20:3402'])
})
