import { randomUUID } from 'node:crypto'
import type { CopilotConversationEvent } from '@phoenix/contracts'
import type { CopilotResult, CopilotRunOptions, CopilotStreamEvent } from '@phoenix/copilot'
import type { CopilotText, CopilotTextRequest } from './copilot-text-service.js'
import type { CopilotConversationEvents } from './copilot-conversation-event-service.js'

type EventPayload = CopilotConversationEvent extends infer Event
  ? Event extends CopilotConversationEvent
    ? Omit<Event, 'clientId' | 'conversationId' | 'occurredAt' | 'turnId'>
    : never
  : never

/** One semantic turn lifecycle for every text response mode, independent of its wire format. */
export class CopilotTurnLifecycle implements CopilotText {
  public constructor (private readonly copilot: CopilotText, private readonly events: CopilotConversationEvents) {}

  public getHistory (conversationId: string) { return this.copilot.getHistory(conversationId) }

  public async run (request: CopilotTextRequest, options?: CopilotRunOptions): Promise<CopilotResult> {
    for await (const event of this.stream(request, options)) {
      if (event.type === 'run.completed') return event.result
    }
    throw new Error('Copilot ended without a completed result.')
  }

  public async *stream (request: CopilotTextRequest, options?: CopilotRunOptions): AsyncGenerator<CopilotStreamEvent, void, void> {
    const turnId = request.turnId ?? randomUUID()
    const clientId = request.clientId ?? `server-${turnId}`
    let conversationId = request.conversationId
    let text = ''
    let started = false
    let terminal = false
    const publish = (event: EventPayload) => {
      if (!conversationId) return
      this.events.publish({ ...event, clientId, conversationId, turnId, occurredAt: new Date().toISOString() } as CopilotConversationEvent)
    }
    const finish = (event: EventPayload) => { terminal = true; publish(event) }
    try {
      options?.signal?.throwIfAborted()
      for await (const event of this.copilot.stream(request, options)) {
        if (event.type === 'run.started') {
          conversationId = event.chatId
          if (!started) { started = true; publish({ source: 'text', type: 'turn.started', userText: request.message }) }
        } else if (event.type === 'text.reset') {
          text = ''
          publish({ final: false, text, type: 'assistant.transcript' })
        } else if (event.type === 'text.delta') {
          text += event.delta
          publish({ final: false, text, type: 'assistant.transcript' })
        } else if (event.type === 'tool.call') {
          publish({ callId: event.call.id, name: event.call.name, status: 'calling', type: 'tool.status' })
        } else if (event.type === 'tool.result') {
          publish({ callId: event.callId, status: event.status, type: 'tool.status' })
        } else if (event.type === 'run.completed') {
          publish({ final: true, text: event.result.text, type: 'assistant.transcript' })
          finish({ type: 'turn.completed' })
        }
        yield event
      }
      if (!terminal) throw new Error('Copilot ended without a completed result.')
    } catch (cause) {
      if (started && !terminal) finish(options?.signal?.aborted
        ? { type: 'turn.cancelled' }
        : { type: 'turn.failed', message: cause instanceof Error ? cause.message : 'Copilot request failed.' })
      throw cause
    } finally {
      // A consumer can close the iterator while the turn is still active.
      if (started && !terminal) finish({ type: 'turn.cancelled' })
    }
  }
}
