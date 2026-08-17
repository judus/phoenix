import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { CommanderEngineersQuery } from './tool-gateways.js'

export class CommanderListEngineersTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List known or locked engineers and their progression, locations, and specialisations.',
    inputSchema: { additionalProperties: false, properties: { includeLocked: { type: 'boolean' }, query: { type: 'string' } }, type: 'object' },
    name: 'commander.list_engineers'
  }
  public constructor (private readonly engineers: CommanderEngineersQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.engineers.listEngineers(arguments_)
}
