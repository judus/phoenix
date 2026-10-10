export type QueryProvider = 'Spansh' | 'Ardent' | 'EDSM'
export type ProviderQueryErrorKind =
  | 'transport' | 'timeout' | 'rate_limit' | 'provider_unavailable'
  | 'authentication' | 'authorization' | 'malformed_response' | 'not_found' | 'reference_system_not_found' | 'request_rejected'

const PUBLIC_MESSAGES: Record<ProviderQueryErrorKind, string> = {
  transport: 'request could not be completed.',
  timeout: 'request timed out.',
  rate_limit: 'request limit was reached.',
  provider_unavailable: 'service is unavailable.',
  authentication: 'authentication failed.',
  authorization: 'request was denied.',
  malformed_response: 'returned an invalid response.',
  not_found: 'has no matching record.',
  reference_system_not_found: 'has no record of your reference system.',
  request_rejected: 'rejected the provider request.'
}

/** Provider failures expose a stable category and safe message; causes stay diagnostic. */
export class ProviderQueryError extends Error {
  public readonly status: number | undefined

  public constructor (
    public readonly provider: QueryProvider,
    public readonly kind: ProviderQueryErrorKind,
    options: { cause?: unknown, status?: number } = {}
  ) {
    super(`${provider} ${PUBLIC_MESSAGES[kind]}`, { cause: options.cause })
    this.name = 'ProviderQueryError'
    this.status = options.status
  }
}
