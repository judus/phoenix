import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpRequestValidationError extends Error {}

export async function readJsonBody (request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 64 * 1024) throw new Error('Request body exceeds 64 KiB.')
    chunks.push(buffer)
  }

  if (chunks.length === 0) throw new Error('Request body is empty.')
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export async function readValidatedJsonBody<T> (
  request: IncomingMessage,
  schema: { parse(value: unknown): T }
): Promise<T> {
  try {
    return schema.parse(await readJsonBody(request))
  } catch (cause) {
    throw new HttpRequestValidationError(cause instanceof Error ? cause.message : 'Invalid request body.')
  }
}

export function writeJson (response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8'
  })
  response.end(body)
}
