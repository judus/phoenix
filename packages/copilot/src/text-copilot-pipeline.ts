import type { RuntimeState } from '@phoenix/contracts'
import type { AiResult, AiRunOptions, AiStreamEvent } from '@judus/llm-client'
import type { AgentPromptComposer } from './agent-profile.js'
import type { RuntimeContextRenderer } from './runtime-context-renderer.js'

export interface CopilotAiRequest {
  run(options?: AiRunOptions): Promise<AiResult>
  stream(options?: AiRunOptions): AsyncGenerator<AiStreamEvent, void, void>
}

export interface CopilotAiClient {
  chat(id: string): { user(message: string): CopilotAiRequest }
  user(message: string): CopilotAiRequest
}

export interface CopilotAiClientFactory {
  create(instructions: string): CopilotAiClient
}

export interface TextCopilotTurn {
  conversationId?: string
  message: string
  profileId: string
  runtimeState: RuntimeState
}

export class TextCopilotPipeline {
  public constructor (
    private readonly clients: CopilotAiClientFactory,
    private readonly prompts: AgentPromptComposer,
    private readonly runtimeContext: RuntimeContextRenderer
  ) {}

  public run (turn: TextCopilotTurn, options?: AiRunOptions): Promise<AiResult> {
    return this.request(turn).run(options)
  }

  public stream (turn: TextCopilotTurn, options?: AiRunOptions): AsyncGenerator<AiStreamEvent, void, void> {
    return this.request(turn).stream(options)
  }

  private request (turn: TextCopilotTurn): CopilotAiRequest {
    const instructions = this.prompts.compose({
      mode: 'text',
      profileId: turn.profileId,
      runtimeContext: this.runtimeContext.render(turn.runtimeState)
    })
    const client = this.clients.create(instructions)
    return turn.conversationId
      ? client.chat(turn.conversationId).user(turn.message)
      : client.user(turn.message)
  }
}
