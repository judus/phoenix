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
    if (event.type === 'turn.completed' || event.type === 'turn.failed') {
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
}

function eventKey (event: CopilotConversationEvent): string {
  return event.type === 'tool.status' ? `${event.type}:${event.callId}` : event.type
}
