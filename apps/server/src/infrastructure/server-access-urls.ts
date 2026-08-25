import { createSocket } from 'node:dgram'
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'

interface ServerAddress {
  host: string
  port: number
}

type NetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>

export function serverAccessUrls (
  address: ServerAddress,
  interfaces: NetworkInterfaces = networkInterfaces(),
  preferredAddress?: string | null
): { local: string, network: string[] } {
  if (!isWildcard(address.host)) {
    return { local: httpUrl(address.host, address.port), network: [] }
  }

  const network = [...new Set(
    Object.values(interfaces)
      .flatMap(entries => entries ?? [])
      .filter(entry => entry.family === 'IPv4' && !entry.internal)
      .map(entry => httpUrl(entry.address, address.port))
  )].sort((left, right) => {
    const preferredUrl = preferredAddress ? httpUrl(preferredAddress, address.port) : null
    if (left === preferredUrl) return -1
    if (right === preferredUrl) return 1
    return left.localeCompare(right)
  })

  return {
    local: httpUrl('localhost', address.port),
    network
  }
}

export async function activeRouteIPv4Address (): Promise<string | null> {
  const socket = createSocket('udp4')
  try {
    await new Promise<void>((resolvePromise, reject) => {
      socket.once('error', reject)
      socket.connect(53, '1.1.1.1', () => {
        socket.off('error', reject)
        resolvePromise()
      })
    })
    const address = socket.address()
    return typeof address === 'string' ? null : address.address
  } catch {
    return null
  } finally {
    socket.close()
  }
}

export function isServerAddress (
  remoteAddress: string | undefined,
  interfaces: NetworkInterfaces = networkInterfaces()
): boolean {
  const remote = normalizeIpAddress(remoteAddress)
  if (!remote) return false
  if (remote === '::1' || remote.startsWith('127.')) return true
  return Object.values(interfaces).some(entries => entries?.some(entry => normalizeIpAddress(entry.address) === remote))
}

function isWildcard (host: string): boolean {
  return host === '0.0.0.0' || host === '::'
}

function httpUrl (host: string, port: number): string {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `http://${formattedHost}:${port}`
}

function normalizeIpAddress (address: string | undefined): string | null {
  if (!address) return null
  const withoutScope = address.toLowerCase().split('%', 1)[0]!
  return withoutScope.startsWith('::ffff:') ? withoutScope.slice('::ffff:'.length) : withoutScope
}
