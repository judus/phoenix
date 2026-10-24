import {
  AiError,
  ToolRegistry,
  type LocalTool,
  type ToolCall,
  type ToolExecutionContext
} from '@jdu/llm-client'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'

// The Galaxy Map routine plus map/route acknowledgement can take about 50 seconds.
export const COPILOT_TOOL_TIMEOUT_MS = 60_000

export class CopilotToolRegistry extends ToolRegistry {
  public constructor (
    tools: readonly LocalTool[],
    private readonly capabilities: Pick<CopilotCapabilities, 'isToolEnabled'>
  ) {
    super(tools)
  }

  public override get definitions () {
    return super.definitions.filter(definition => this.capabilities.isToolEnabled(definition.name))
  }

  public override definition (name: string) {
    return this.capabilities.isToolEnabled(name) ? super.definition(name) : undefined
  }

  public override execute (call: ToolCall, context: ToolExecutionContext) {
    if (!this.capabilities.isToolEnabled(call.name)) {
      return Promise.reject(new AiError('authorization', 'This Copilot tool is disabled in Settings. Ask the user to review its permissions; do not retry unchanged.', {
        code: 'copilot_tool_disabled',
        retryable: false
      }))
    }
    return super.execute(call, context)
  }
}
