import type {
  AiResult,
  AiRunOptions,
  AiStreamEvent,
  ConversationStore
} from '@judus/llm-client'
import type { CopilotChatRequest, CopilotHistoryMessage } from '@phoenix/contracts'
import type { TextCopilotPipeline } from '@phoenix/copilot'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export type CopilotTextRequest = CopilotChatRequest

export interface CopilotText {
  getHistory(conversationId: string): Promise<readonly CopilotHistoryMessage[]>
  run(request: CopilotTextRequest, options?: AiRunOptions): Promise<AiResult>
  stream(request: CopilotTextRequest, options?: AiRunOptions): AsyncGenerator<AiStreamEvent, void, void>
}

export class CopilotTextService implements CopilotText {
  public constructor (
    private readonly pipeline: TextCopilotPipeline,
    private readonly runtimeState: RuntimeStateReader,
    private readonly conversations: ConversationStore,
    private readonly defaultProfileId = 'marin'
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

  public run (request: CopilotTextRequest, options?: AiRunOptions): Promise<AiResult> {
    return this.pipeline.run(this.turn(request), options)
  }

  public stream (
    request: CopilotTextRequest,
    options?: AiRunOptions
  ): AsyncGenerator<AiStreamEvent, void, void> {
    return this.pipeline.stream(this.turn(request), options)
  }

  private turn (request: CopilotTextRequest) {
    return {
      ...(request.conversationId === undefined ? {} : { conversationId: request.conversationId }),
      message: request.message,
      profileId: request.profileId ?? this.defaultProfileId,
      runtimeState: this.runtimeState.getCurrent()
    }
  }
}
