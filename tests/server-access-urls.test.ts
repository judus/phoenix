import { expect, test } from 'vitest'
import { serverAccessUrls } from '../apps/server/src/infrastructure/server-access-urls.js'
import { requireLoopbackHost } from '../apps/server/src/infrastructure/loopback-host.js'

test('rejects direct non-loopback HTTP listeners', () => {
  expect(() => requireLoopbackHost('0.0.0.0')).toThrow('trusted local reverse proxy')
  expect(() => requireLoopbackHost('192.168.1.42')).toThrow('non-loopback host')
})

test('presents the configured host without inventing network alternatives', () => {
  expect(serverAccessUrls({ host: '127.0.0.1', port: 3400 })).toEqual({
    local: 'http://127.0.0.1:3400',
    network: []
  })
  expect(requireLoopbackHost('localhost')).toBe('localhost')
  expect(requireLoopbackHost('::1')).toBe('::1')
})
