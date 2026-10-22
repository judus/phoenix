import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { EliteDestinations } from '../../domain/elite-destination.js'
import { json, output, stringArgument, ToolArgumentError } from './tool-support.js'

export class NavigationPlotRouteTool implements LocalTool {
  public readonly definition: LocalTool['definition'] = {
    annotations: { destructive: false, idempotent: false, openWorld: false, readOnly: false },
    description: 'Plot a route to a named system in Elite Dangerous using the same Galaxy Map input routine as the system schematic Plot route button. This sends game input: use only when the commander explicitly asks to plot a route, not for destination searches, reachability questions or showing a PHOENIX map. Elite must be running and focused with the required keyboard bindings. Elite calculates the route. Only status confirmed means a new route to the requested system was observed; rejected, failed or timed_out do not confirm a route. Preserve the returned status, phase and binding warnings. Input may already have been sent on failure; do not retry automatically or invent why Elite refused the route.',
    inputSchema: {
      additionalProperties: false,
      properties: { systemName: { minLength: 1, maxLength: 128, type: 'string' } },
      required: ['systemName'],
      type: 'object'
    },
    name: 'navigation.plot_route'
  }

  public constructor (private readonly destinations: EliteDestinations) {}

  public readonly execute: LocalTool['execute'] = async (arguments_: JsonObject, context) => {
    const systemName = stringArgument(arguments_, 'systemName')
    if (systemName.length > 128) throw new ToolArgumentError('systemName must contain at most 128 characters.', 'Provide the exact system name, at most 128 characters.')
    context.signal.throwIfAborted()
    const result = await this.destinations.plot(systemName, context.signal)
    context.signal.throwIfAborted()
    return output(
      `Route plotting ${result.status} at ${result.phase}: ${result.message}${result.status === 'confirmed' ? '' : ' Do not claim the route is plotted or repeat the operation without a new user request.'}`,
      json(result)
    )
  }
}
