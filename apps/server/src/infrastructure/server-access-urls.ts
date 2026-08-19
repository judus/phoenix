import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'

interface ServerAddress {
  host: string
  port: number
}

type NetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>

export function serverAccessUrls (
  address: ServerAddress,
  interfaces: NetworkInterfaces = networkInterfaces()
): { local: string, network: string[] } {
  if (!isWildcard(address.host)) {
    return { local: httpUrl(address.host, address.port), network: [] }
  }

  const network = [...new Set(
    Object.values(interfaces)
      .flatMap(entries => entries ?? [])
      .filter(entry => entry.family === 'IPv4' && !entry.internal)
      .map(entry => httpUrl(entry.address, address.port))
  )].sort()

  return {
    local: httpUrl('localhost', address.port),
    network
  }
}

function isWildcard (host: string): boolean {
  return host === '0.0.0.0' || host === '::'
}

function httpUrl (host: string, port: number): string {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `http://${formattedHost}:${port}`
}
