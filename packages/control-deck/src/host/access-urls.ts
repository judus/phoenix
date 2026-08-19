import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'
import type { SatelliteServerAddress } from './satellite-server.js'

export function satelliteAccessUrls (
  address: SatelliteServerAddress,
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): string[] {
  if (!['0.0.0.0', '::'].includes(address.host)) return [httpUrl(address.host, address.port)]
  const hosts = Object.values(interfaces)
    .flatMap(entries => entries ?? [])
    .filter(entry => !entry.internal && (entry.family === 'IPv4' || entry.family === 'IPv6'))
    .map(entry => entry.address)
  return [...new Set(hosts)].sort().map(host => httpUrl(host, address.port))
}

function httpUrl (host: string, port: number): string {
  return `http://${host.includes(':') ? `[${host}]` : host}:${port}`
}
