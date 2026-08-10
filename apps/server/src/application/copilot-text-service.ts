import type { AiResult, AiRunOptions, AiStreamEvent } from '@maduser/ai-ts'
import type { TextCopilotPipeline } from '@phoenix/copilot'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export interface CopilotTextRequest {
  conversationId?: string
  message: string
  profileId?: string
}

export interface CopilotText {
  run(request: CopilotTextRequest, options?: AiRunOptions): Promise<AiResult>
  stream(request: CopilotTextRequest, options?: AiRunOptions): AsyncGenerator<AiStreamEvent, void, void>
}

export class CopilotTextService implements CopilotText {
  public constructor (
    private readonly pipeline: TextCopilotPipeline,
    private readonly runtimeState: RuntimeStateReader,
    private readonly defaultProfileId = 'icarus'
  ) {}

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
