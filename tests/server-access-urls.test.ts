import type { NetworkInterfaceInfo } from 'node:os'
import { expect, test } from 'vitest'
import { isServerAddress, serverAccessUrls } from '../apps/server/src/infrastructure/server-access-urls.js'

test('presents localhost and LAN URLs for a wildcard listener', () => {
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

test('presents the active-route address first for pairing', () => {
  const interfaces = {
    ethernet: [interfaceInfo('192.168.1.42', false)],
    vpn: [interfaceInfo('10.8.0.2', false)]
  }

  expect(serverAccessUrls({ host: '0.0.0.0', port: 3400 }, interfaces, '192.168.1.42').network).toEqual([
    'http://192.168.1.42:3400',
    'http://10.8.0.2:3400'
  ])
})

test('presents the configured host without inventing network alternatives', () => {
  expect(serverAccessUrls({ host: '127.0.0.1', port: 3400 }, {})).toEqual({
    local: 'http://127.0.0.1:3400',
    network: []
  })
})

test('recognizes loopback, mapped loopback, and this computer network addresses', () => {
  const interfaces = { ethernet: [interfaceInfo('192.168.1.42', false)] }

  expect(isServerAddress('127.0.0.1', interfaces)).toBe(true)
  expect(isServerAddress('::ffff:127.0.0.1', interfaces)).toBe(true)
  expect(isServerAddress('192.168.1.42', interfaces)).toBe(true)
  expect(isServerAddress('192.168.1.73', interfaces)).toBe(false)
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
