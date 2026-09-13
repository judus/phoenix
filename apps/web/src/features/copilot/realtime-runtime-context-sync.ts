export interface RealtimeRuntimeContextSnapshot {
  fingerprint: string
  text: string
}

export type RealtimeRuntimeContextEvent =
  | {
      item: {
        content: [{ text: string, type: 'input_text' }]
        id: string
        role: 'system'
        type: 'message'
      }
      type: 'conversation.item.create'
    }
  | { item_id: string, type: 'conversation.item.delete' }

export class RealtimeRuntimeContextSync {
  private current?: { fingerprint: string, itemId: string }
  private revision = 0

  public reset (): void {
    this.current = undefined
    this.revision = 0
  }

  public sync (
    context: RealtimeRuntimeContextSnapshot,
    send: (event: RealtimeRuntimeContextEvent) => void
  ): void {
    if (context.fingerprint === this.current?.fingerprint) return

    if (this.current) {
      send({ item_id: this.current.itemId, type: 'conversation.item.delete' })
      this.current = undefined
    }

    const itemId = `phoenix-runtime-context-${++this.revision}`
    send({
      item: {
        content: [{ text: context.text, type: 'input_text' }],
        id: itemId,
        role: 'system',
        type: 'message'
      },
      type: 'conversation.item.create'
    })
    this.current = { fingerprint: context.fingerprint, itemId }
  }
}
