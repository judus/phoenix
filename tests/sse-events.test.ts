import { expect, test, vi } from 'vitest'
import { readSseEvents } from './support/sse-events.js'

test.each(['coalesced', 'fragmented'])('SSE reader preserves events after comments with %s chunks', async mode => {
  const bytes = new TextEncoder().encode(': connected\n\nevent: first\ndata: "é"\n\nevent: second\ndata: 2\n\n')
  const split = bytes.indexOf(0xc3) + 1
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start (controller) {
      const chunks = mode === 'coalesced' ? [bytes] : [
        bytes.slice(0, split), bytes.slice(split, bytes.length - 1), bytes.slice(-1)
      ]
      for (const chunk of chunks) controller.enqueue(chunk)
    },
    cancel
  })
  const events = readSseEvents(new Response(body))
  try {
    await expect(events.next()).resolves.toEqual({ done: false, value: { event: 'first', data: '"é"' } })
    await expect(events.next()).resolves.toEqual({ done: false, value: { event: 'second', data: '2' } })
  } finally { await events.return() }
  expect(cancel).toHaveBeenCalledOnce()
  expect(body.locked).toBe(false)
})

test('breaking consumption cancels the stream without waiting for another network chunk', async () => {
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start: controller => controller.enqueue(new TextEncoder().encode(': connected\n\nevent: command\ndata: {}\n\n')),
    cancel
  })
  for await (const event of readSseEvents(new Response(body))) {
    expect(event).toEqual({ event: 'command', data: '{}' })
    break
  }
  expect(cancel).toHaveBeenCalledOnce()
  expect(body.locked).toBe(false)
})

test('missing bodies, premature EOF and malformed named events fail clearly', async () => {
  await expect(readSseEvents(new Response(null)).next()).rejects.toThrow('no body')
  for (const content of ['', ': connected\n\n', 'event: partial\ndata: {}']) {
    const response = new Response(content)
    await expect(readSseEvents(response).next()).rejects.toThrow('ended before')
    expect(response.body!.locked).toBe(false)
  }
  const response = new Response('event: broken\n\n')
  await expect(readSseEvents(response).next()).rejects.toThrow('broken has no data')
  expect(response.body!.locked).toBe(false)
})
