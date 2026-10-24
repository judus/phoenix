import { EventEmitter } from 'node:events'
import { expect, test } from 'vitest'
import type { CopilotConversationEvent } from '@phoenix/contracts'
import type { CopilotStreamEvent } from '@phoenix/copilot'
import type { CopilotText } from '../apps/server/src/application/copilot-text-service.js'
import { CopilotTurnLifecycle } from '../apps/server/src/application/copilot-turn-lifecycle.js'
import { CopilotConversationEventService } from '../apps/server/src/application/copilot-conversation-event-service.js'
import { watchCopilotDisconnect } from '../apps/server/src/infrastructure/copilot-http-disconnect.js'

const request = { message: 'Synthetic request', conversationId: 'chat', clientId: 'client', turnId: 'turn' }
const started: CopilotStreamEvent = { type: 'run.started', chatId: 'chat' }
const completed: CopilotStreamEvent = { type: 'run.completed', result: { chatId: 'chat', text: 'Done.', finishReason: 'stop', usage: {} } }

test.each(['run', 'stream'] as const)('%s publishes one completed lifecycle and clears active turn state', async mode => {
  const f = fixture([started, { type: 'text.delta', delta: 'Done.' }, completed])
  if (mode === 'run') expect(await f.service.run(request)).toMatchObject({ text: 'Done.' })
  else { const events = []; for await (const event of f.service.stream(request)) events.push(event); expect(events.at(-1)).toEqual(completed) }
  expect(f.received.map(event => event.type)).toEqual(['turn.started', 'assistant.transcript', 'assistant.transcript', 'turn.completed'])
  expect(f.events.active('chat')).toEqual([])
  expect(f.disposed()).toBe(true)
})

test('consumer return closes the underlying turn and publishes cancellation once', async () => {
  const f = fixture([started, completed])
  const iterator = f.service.stream(request)
  await iterator.next()
  await iterator.return()
  expect(f.received.map(event => event.type)).toEqual(['turn.started', 'turn.cancelled'])
  expect(f.events.active('chat')).toEqual([])
  expect(f.disposed()).toBe(true)
})

test('a completed turn is not relabelled cancelled when the result consumer subsequently disconnects', async () => {
  const f = fixture([started, completed])
  const controller = new AbortController()
  const iterator = f.service.stream(request, { signal: controller.signal })
  await iterator.next()
  await iterator.next()
  controller.abort()
  await iterator.return()
  expect(f.received.filter(event => event.type.startsWith('turn.')).map(event => event.type)).toEqual(['turn.started', 'turn.completed'])
  expect(f.events.active('chat')).toEqual([])
})

test('ordinary failure preserves the error and closes the lifecycle once', async () => {
  const cause = new Error('synthetic provider failure')
  const f = fixture([started], cause)
  await expect(f.service.run(request)).rejects.toBe(cause)
  expect(f.received.map(event => event.type)).toEqual(['turn.started', 'turn.failed'])
  expect(f.events.active('chat')).toEqual([])
})

test('missing completion fails instead of silently leaving an active turn', async () => {
  const f = fixture([started])
  await expect(f.service.run(request)).rejects.toThrow('without a completed result')
  expect(f.received.map(event => event.type)).toEqual(['turn.started', 'turn.failed'])
  expect(f.events.active('chat')).toEqual([])
})

test.each([false, true])('response close cancels only unfinished responses (finished=%s)', finished => {
  const response = Object.assign(new EventEmitter(), { writableFinished: finished, destroyed: false })
  const connection = watchCopilotDisconnect(response)
  expect(response.listenerCount('close')).toBe(1)
  response.emit('close')
  expect(connection.signal.aborted).toBe(!finished)
  connection.dispose()
  expect(response.listenerCount('close')).toBe(0)
})

test('disposing disconnect detection removes its listener before a later close', () => {
  const response = Object.assign(new EventEmitter(), { writableFinished: false, destroyed: false })
  const connection = watchCopilotDisconnect(response)
  connection.dispose()
  response.emit('close')
  expect(connection.signal.aborted).toBe(false)
  expect(response.listenerCount('close')).toBe(0)
})

test('a response already disconnected before listener installation starts cancelled', () => {
  const response = Object.assign(new EventEmitter(), { writableFinished: false, destroyed: true })
  const connection = watchCopilotDisconnect(response)
  expect(connection.signal.aborted).toBe(true)
  connection.dispose()
  expect(response.listenerCount('close')).toBe(0)
})

function fixture (stream: CopilotStreamEvent[], cause?: Error) {
  let disposed = false
  const copilot: CopilotText = {
    getHistory: async () => [],
    run: async () => { throw new Error('Lifecycle must use the shared streaming turn, not a separate run policy.') },
    stream: async function * () {
      try { for (const event of stream) yield event; if (cause) throw cause } finally { disposed = true }
    }
  }
  const events = new CopilotConversationEventService()
  const received: CopilotConversationEvent[] = []
  events.subscribe(event => received.push(event))
  return { service: new CopilotTurnLifecycle(copilot, events), received, events, disposed: () => disposed }
}
