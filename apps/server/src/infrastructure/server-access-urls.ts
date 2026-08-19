import { requireLoopbackHost } from './loopback-host.js'

interface ServerAddress {
  host: string
  port: number
}

export function serverAccessUrls (
  address: ServerAddress
): { local: string, network: string[] } {
  return {
    local: httpUrl(requireLoopbackHost(address.host), address.port),
    network: []
  }
}

function httpUrl (host: string, port: number): string {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `http://${formattedHost}:${port}`
}
