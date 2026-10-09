import { randomUUID } from 'node:crypto'
import type { JsonObject } from '@jdu/llm-client'
import { DisplayCommandSchema, type DisplayCommand } from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { Publisher } from '../domain/publisher.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import { optionalStringArgument, output, ToolArgumentError } from './mcp-tools/tool-support.js'

/** Resolve a real location before telling connected displays to navigate. */
export class DisplayAtlasService {
  public constructor (
    private readonly commands: Publisher<DisplayCommand>,
    private readonly cartography: SystemCartography,
    private readonly runtime: RuntimeStateReader
  ) {}

  public async show (arguments_: JsonObject) {
    const systemName = optionalStringArgument(arguments_, 'systemName') ?? this.runtime.getCurrent().system.name
    if (!systemName) throw new ToolArgumentError('The current system is unknown.', 'Provide systemName explicitly, or wait until the current system is reported.')
    const { system } = await this.cartography.getSystem(systemName)
    if (!system.position) throw new ToolArgumentError(`Coordinates are unavailable for ${system.name}. Nothing was displayed.`,
      'Use display.show_system_schematic to inspect this system without galaxy coordinates, or choose a system with known coordinates. Do not invent coordinates or retry the same Atlas request.')
    const location = { systemName: system.name, position: system.position }
    this.commands.publish(DisplayCommandSchema.parse({
      id: randomUUID(), type: 'show_atlas', location, createdAt: new Date().toISOString()
    }))
    return output(`Opened the PHOENIX Galactic Atlas at ${system.name}.`, { displayed: true, location })
  }
}
