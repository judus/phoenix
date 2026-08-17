import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { NavigationQuery } from './tool-gateways.js'
import { emptyObjectSchema } from './tool-support.js'

export class NavigationGetRouteTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return the locally plotted navigation route, including the next hop and final destination.',
    inputSchema: emptyObjectSchema(),
    name: 'navigation.get_route'
  }
  public constructor (private readonly navigation: NavigationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.navigation.getRoute(arguments_)
}
