import type { CopilotConversationEvent } from '@phoenix/contracts'
import type { Publisher, Subscribable, Unsubscribe } from '../domain/publisher.js'

export interface CopilotConversationEvents extends
Publisher<CopilotConversationEvent>, Subscribable<CopilotConversationEvent> {
  active(conversationId: string): readonly CopilotConversationEvent[]
}

export class CopilotConversationEventService implements CopilotConversationEvents {
  private readonly listeners = new Set<(event: CopilotConversationEvent) => void>()
  private readonly activeTurns = new Map<string, Map<string, CopilotConversationEvent[]>>()

  public publish (event: CopilotConversationEvent): void {
    if (event.type === 'turn.started') {
      for (const cancelled of this.cancelSupersededTurns(event)) {
        this.remember(cancelled)
        for (const listener of this.listeners) listener(cancelled)
      }
    }
    this.remember(event)
    for (const listener of this.listeners) listener(event)
  }

  public active (conversationId: string): readonly CopilotConversationEvent[] {
    return [...(this.activeTurns.get(conversationId)?.values() ?? [])].flat()
  }

  public subscribe (listener: (event: CopilotConversationEvent) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private remember (event: CopilotConversationEvent): void {
    if (event.type === 'turn.completed' || event.type === 'turn.cancelled' || event.type === 'turn.failed') {
      const conversation = this.activeTurns.get(event.conversationId)
      conversation?.delete(event.turnId)
      if (conversation?.size === 0) this.activeTurns.delete(event.conversationId)
      return
    }
    const conversation = this.activeTurns.get(event.conversationId) ?? new Map()
    const turn: CopilotConversationEvent[] = conversation.get(event.turnId) ?? []
    const retained = turn.filter(existing => eventKey(existing) !== eventKey(event))
    retained.push(event)
    conversation.set(event.turnId, retained)
    this.activeTurns.set(event.conversationId, conversation)
  }

  private cancelSupersededTurns (
    event: Extract<CopilotConversationEvent, { type: 'turn.started' }>
  ): CopilotConversationEvent[] {
    const conversation = this.activeTurns.get(event.conversationId)
    if (!conversation) return []
    const cancelled: CopilotConversationEvent[] = []
    for (const [turnId, events] of conversation) {
      if (turnId === event.turnId || events[0]?.clientId !== event.clientId) continue
      cancelled.push({
        clientId: event.clientId,
        conversationId: event.conversationId,
        occurredAt: event.occurredAt,
        turnId,
        type: 'turn.cancelled'
      })
    }
    return cancelled
  }
}

function eventKey (event: CopilotConversationEvent): string {
  return event.type === 'tool.status' ? `${event.type}:${event.callId}` : event.type
}
