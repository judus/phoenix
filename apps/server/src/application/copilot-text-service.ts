import type { ConversationStore } from '@jdu/llm-client'
import type { CopilotChatRequest, CopilotHistoryMessage } from '@phoenix/contracts'
import type { TextCopilotPipeline, CopilotResult, CopilotRunOptions, CopilotStreamEvent } from '@phoenix/copilot'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export type CopilotTextRequest = CopilotChatRequest

export interface CopilotText {
  getHistory(conversationId: string): Promise<readonly CopilotHistoryMessage[]>
  run(request: CopilotTextRequest, options?: CopilotRunOptions): Promise<CopilotResult>
  stream(request: CopilotTextRequest, options?: CopilotRunOptions): AsyncGenerator<CopilotStreamEvent, void, void>
}

export class CopilotTextService implements CopilotText {
  public constructor (
    private readonly pipeline: TextCopilotPipeline,
    private readonly runtimeState: RuntimeStateReader,
    private readonly conversations: ConversationStore,
    private readonly activeProfileId: () => string = () => 'marin'
  ) {}

  public async getHistory (conversationId: string): Promise<readonly CopilotHistoryMessage[]> {
    const snapshot = await this.conversations.snapshot(conversationId)
    if (!snapshot) return []
    return snapshot.messages.flatMap(message => {
      if (!['assistant', 'system', 'user'].includes(message.role)) return []
      const text = message.content.flatMap(part => {
        if (part.type === 'text') return [part.text]
        if (part.type === 'refusal') return [part.reason]
        return []
      }).join('\n').trim()
      if (!text) return []
      return [{
        createdAt: message.createdAt,
        id: message.id,
        role: message.role as CopilotHistoryMessage['role'],
        text
      }]
    })
  }

  public run (request: CopilotTextRequest, options?: CopilotRunOptions): Promise<CopilotResult> {
    return this.pipeline.run(this.turn(request), options)
  }

  public stream (
    request: CopilotTextRequest,
    options?: CopilotRunOptions
  ): AsyncGenerator<CopilotStreamEvent, void, void> {
    return this.pipeline.stream(this.turn(request), options)
  }

  private turn (request: CopilotTextRequest) {
    return {
      ...(request.conversationId === undefined ? {} : { conversationId: request.conversationId }),
      message: request.message,
      profileId: request.profileId ?? this.activeProfileId(),
      runtimeState: this.runtimeState.getCurrent()
    }
  }
}
