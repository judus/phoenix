import type { NetworkInterfaceInfo } from 'node:os'
import { expect, test } from 'vitest'
import { serverAccessUrls } from '../apps/server/src/infrastructure/server-access-urls.js'
import { requireHttpListenHost } from '../apps/server/src/infrastructure/loopback-host.js'

test('requires explicit acknowledgement for cleartext LAN listeners', () => {
  expect(() => requireHttpListenHost('0.0.0.0')).toThrow('PHOENIX_ALLOW_INSECURE_LAN_HTTP=true')
  expect(() => requireHttpListenHost('192.168.1.42')).toThrow('non-loopback host')
  expect(requireHttpListenHost('0.0.0.0', true)).toBe('0.0.0.0')
  expect(requireHttpListenHost('192.168.1.42', true)).toBe('192.168.1.42')
})

test('presents localhost and LAN URLs for an explicitly allowed wildcard listener', () => {
  const interfaces = {
    lo: [interfaceInfo('127.0.0.1', true)],
    ethernet: [interfaceInfo('192.168.1.42', false)],
    vpn: [interfaceInfo('10.8.0.2', false)]
  }

  expect(serverAccessUrls({ host: '0.0.0.0', port: 3490 }, interfaces)).toEqual({
    local: 'http://localhost:3490',
    network: ['http://10.8.0.2:3490', 'http://192.168.1.42:3490']
  })
})

test('presents a configured loopback host without inventing network alternatives', () => {
  expect(serverAccessUrls({ host: '127.0.0.1', port: 3400 })).toEqual({
    local: 'http://127.0.0.1:3400',
    network: []
  })
  expect(requireHttpListenHost('localhost')).toBe('localhost')
  expect(requireHttpListenHost('::1')).toBe('::1')
})

function interfaceInfo (address: string, internal: boolean): NetworkInterfaceInfo {
  return {
    address,
    cidr: `${address}/24`,
    family: 'IPv4',
    internal,
    mac: '00:00:00:00:00:00',
    netmask: '255.255.255.0'
  }
}
