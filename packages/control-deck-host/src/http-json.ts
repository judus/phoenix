import type { IncomingMessage, ServerResponse } from 'node:http'

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

export function writeJson (response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(body)}\n`)
}
