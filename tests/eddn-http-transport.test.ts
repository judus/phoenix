import { createServer } from 'node:http'
import { gunzipSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { EddnHttpTransport } from '../apps/server/src/infrastructure/eddn-http-transport.js'
import type { EddnMessage } from '../apps/server/src/domain/eddn.js'

test('HTTP sender posts JSON to a local fake gateway, refuses live schemas and arbitrary destinations', async () => {
  const received: Buffer[] = []
  const server = createServer((request, response) => {
    expect(request.httpVersion).toBe('1.1')
    expect(request.method).toBe('POST')
    expect(request.headers['content-type']).toBe('application/json')
    expect(request.headers['content-encoding']).toBe('gzip')
    expect(request.headers['user-agent']).toBe('PHOENIX/0.1.2')
    request.on('data', data => received.push(Buffer.from(data)))
    request.on('end', () => { response.writeHead(200); response.end('OK') })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const transport = new EddnHttpTransport(`http://127.0.0.1:${address.port}/upload/`)
  const message: EddnMessage = { $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
    header: { uploaderID: 'Test', softwareName: 'PHOENIX', softwareVersion: '0.1.2', gameversion: '4.0', gamebuild: 'r1' }, message: {} }
  try {
    expect(await transport.send(message, new AbortController().signal)).toEqual({ status: 200 })
    expect(JSON.parse(gunzipSync(Buffer.concat(received)).toString('utf8'))).toEqual(message)
    await expect(transport.send({ ...message, $schemaRef: message.$schemaRef.replace('/test', '') }, new AbortController().signal)).rejects.toThrow('Production')
    expect(() => new EddnHttpTransport('https://example.com/upload')).toThrow('official gateway')
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
