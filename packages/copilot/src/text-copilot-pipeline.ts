import type { RuntimeState } from '@phoenix/contracts'
import type { CopilotResult, CopilotRunOptions, CopilotStreamEvent } from './copilot-client.js'
import type { AgentPromptComposer } from './agent-profile.js'
import type { RuntimeContextRenderer } from './runtime-context-renderer.js'

export interface CopilotAiRequest {
  run(options?: CopilotRunOptions): Promise<CopilotResult>
  stream(options?: CopilotRunOptions): AsyncGenerator<CopilotStreamEvent, void, void>
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

  public run (turn: TextCopilotTurn, options?: CopilotRunOptions): Promise<CopilotResult> {
    return this.request(turn).run(options)
  }

  public stream (turn: TextCopilotTurn, options?: CopilotRunOptions): AsyncGenerator<CopilotStreamEvent, void, void> {
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
