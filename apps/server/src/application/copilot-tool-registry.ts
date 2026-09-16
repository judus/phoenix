import {
  ToolRegistry,
  type LocalTool,
  type ToolCall,
  type ToolExecutionContext
} from '@jdu/llm-client'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'

export class CopilotToolRegistry extends ToolRegistry {
  public constructor (
    tools: readonly LocalTool[],
    private readonly capabilities: CopilotCapabilities
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
      return Promise.reject(new Error(`Copilot capability ${call.name} is disabled in Settings.`))
    }
    return super.execute(call, context)
  }
}
