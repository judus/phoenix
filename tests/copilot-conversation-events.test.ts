import { expect, test } from 'vitest'
import type { CopilotConversationEvent } from '@phoenix/contracts'
import { CopilotConversationEventService } from '../apps/server/src/application/copilot-conversation-event-service.js'

test('a new turn cancels an older live turn from the same browser client', () => {
  const events = new CopilotConversationEventService()
  const received: CopilotConversationEvent[] = []
  events.subscribe(event => received.push(event))

  events.publish(started('turn-1', '2026-08-11T15:00:00.000Z'))
  events.publish({
    ...base('turn-1', '2026-08-11T15:00:01.000Z'),
    final: false,
    text: 'Partial response',
    type: 'assistant.transcript'
  })
  events.publish(started('turn-2', '2026-08-11T15:00:02.000Z'))

  expect(received.slice(-2).map(event => ({ turnId: event.turnId, type: event.type }))).toEqual([
    { turnId: 'turn-1', type: 'turn.cancelled' },
    { turnId: 'turn-2', type: 'turn.started' }
  ])
  expect(events.active('phoenix-copilot').map(event => event.turnId)).toEqual(['turn-2'])
})

test('an explicit cancellation removes a disconnected browser turn', () => {
  const events = new CopilotConversationEventService()
  events.publish(started('turn-1', '2026-08-11T15:00:00.000Z'))
  events.publish({ ...base('turn-1', '2026-08-11T15:00:01.000Z'), type: 'turn.cancelled' })
  expect(events.active('phoenix-copilot')).toEqual([])
})

test('superseding a turn preserves another client and another conversation', () => {
  const events = new CopilotConversationEventService()
  events.publish(started('old', '2026-08-11T15:00:00.000Z'))
  events.publish({ ...started('tablet', '2026-08-11T15:00:00.000Z'), clientId: 'tablet' })
  events.publish({ ...started('other-chat', '2026-08-11T15:00:00.000Z'), conversationId: 'other' })
  events.publish(started('replacement', '2026-08-11T15:00:01.000Z'))
  expect(events.active('phoenix-copilot').map(event => event.turnId)).toEqual(['tablet', 'replacement'])
  expect(events.active('other').map(event => event.turnId)).toEqual(['other-chat'])
})

function started (turnId: string, occurredAt: string): CopilotConversationEvent {
  return {
    ...base(turnId, occurredAt),
    source: 'realtime',
    type: 'turn.started',
    userText: ''
  }
}

function base (turnId: string, occurredAt: string) {
  return {
    clientId: 'desktop-browser',
    conversationId: 'phoenix-copilot',
    occurredAt,
    turnId
  }
}
