import { isIP } from 'node:net'

export function requireHttpListenHost (host: string, allowInsecureLanHttp = false): string {
  const normalized = host.trim().toLowerCase()
  const version = isIP(normalized)
  if (normalized === 'localhost' || normalized === '::1' || (version === 4 && normalized.startsWith('127.'))) {
    return host
  }
  if (allowInsecureLanHttp && normalized.length > 0) return host
  throw new Error(
    `PHOENIX cannot bind its HTTP server to non-loopback host ${host}. ` +
    'Terminate HTTPS in a trusted local reverse proxy and forward it to 127.0.0.1, or explicitly ' +
    'accept cleartext operation on a trusted LAN with PHOENIX_ALLOW_INSECURE_LAN_HTTP=true.'
  )
}
