import { ProviderQueryError, type ProviderQueryErrorKind, type QueryProvider } from '../domain/provider-query-error.js'

export async function fetchProviderJson (
  provider: QueryProvider,
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit
): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(url, init)
  } catch (cause) {
    throw new ProviderQueryError(provider, requestFailureKind(cause, init.signal), { cause })
  }
  if (!response.ok) {
    throw new ProviderQueryError(provider, statusFailureKind(response.status), { status: response.status })
  }
  try {
    return await response.json()
  } catch (cause) {
    // A timeout/network failure can also occur while consuming a successful response body.
    const kind = requestFailureKind(cause, init.signal)
    throw new ProviderQueryError(provider, cause instanceof SyntaxError ? 'malformed_response' : kind, { cause })
  }
}

function requestFailureKind (cause: unknown, signal: AbortSignal | null | undefined): 'timeout' | 'transport' {
  if ((signal?.aborted && signal.reason instanceof Error && signal.reason.name === 'TimeoutError') ||
    (cause instanceof Error && cause.name === 'TimeoutError')) return 'timeout'
  return 'transport'
}

function statusFailureKind (status: number): ProviderQueryErrorKind {
  if (status === 401) return 'authentication'
  if (status === 403) return 'authorization'
  if (status === 404) return 'not_found'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'provider_unavailable'
  if (status >= 400) return 'request_rejected'
  return 'transport'
}
