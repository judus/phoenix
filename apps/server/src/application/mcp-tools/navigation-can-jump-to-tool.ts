import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { NavigationQuery } from './tool-gateways.js'

export class NavigationCanJumpToTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Estimate whether the current ship can make a single jump to a named system using current maximum jump range. This does not plan a multi-jump route.',
    inputSchema: { additionalProperties: false, properties: { systemName: { minLength: 1, type: 'string' } }, required: ['systemName'], type: 'object' },
    name: 'navigation.can_jump_to'
  }
  public constructor (private readonly navigation: NavigationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.navigation.canJumpTo(arguments_)
}
