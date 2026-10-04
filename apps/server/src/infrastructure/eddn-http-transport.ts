import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import type { EddnMessage, EddnTransport } from '../domain/eddn.js'

const UPLOAD_URL = 'https://eddn.edcd.io:4430/upload/'

export class EddnHttpTransport implements EddnTransport {
  private readonly endpoint: URL

  public constructor (endpoint = UPLOAD_URL) {
    this.endpoint = new URL(endpoint)
    if (endpoint !== UPLOAD_URL && !(this.endpoint.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(this.endpoint.hostname))) {
      throw new Error('EDDN transport only accepts the official gateway or a loopback test server.')
    }
  }

  public send (message: EddnMessage, signal: AbortSignal): Promise<{ status: number }> {
    if (!message.$schemaRef.endsWith('/test')) return Promise.reject(new Error('Production EDDN publishing is not enabled in this build.'))
    const body = JSON.stringify(message)
    return new Promise((resolve, reject) => {
      const request = this.endpoint.protocol === 'https:' ? httpsRequest : httpRequest
      const pending = request(this.endpoint, {
        method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
      }, response => {
        // Do not retain or expose remote response bodies (which may echo observations).
        response.destroy()
        resolve({ status: response.statusCode ?? 0 })
      })
      pending.on('error', reject)
      pending.end(body)
    })
  }
}
