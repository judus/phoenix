export interface SseEvent {
  event: string
  data: string
}

/** Reads PHOENIX's named, LF-delimited JSON events, independent of transport chunks. */
export async function * readSseEvents (response: Response): AsyncGenerator<SseEvent, void, void> {
  if (!response.body) throw new Error('SSE response has no body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) throw new Error('SSE stream ended before the expected events arrived.')
      buffered += decoder.decode(chunk.value, { stream: true })
      let boundary: number
      while ((boundary = buffered.indexOf('\n\n')) >= 0) {
        const lines = buffered.slice(0, boundary).split('\n')
        buffered = buffered.slice(boundary + 2)
        const event = lines.find(line => line.startsWith('event: '))?.slice(7)
        if (!event) continue // Connected/heartbeat comments do not carry events.
        const data = lines.find(line => line.startsWith('data: '))?.slice(6)
        if (data === undefined) throw new Error(`SSE event ${event} has no data.`)
        yield { event, data }
      }
    }
  } finally {
    try { await reader.cancel() } finally { reader.releaseLock() }
  }
}
