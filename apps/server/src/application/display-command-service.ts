import { randomUUID } from 'node:crypto'
import type { JsonObject } from '@maduser/ai-ts'
import { DisplayCommandSchema, type DisplayCommand } from '@phoenix/contracts'
import type { Publisher, Subscribable, Unsubscribe } from '../domain/publisher.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { DisplayCommands } from './mcp-tools/tool-gateways.js'
import { optionalStringArgument, output, stringArgument } from './mcp-tools/tool-support.js'

export class DisplayCommandService implements DisplayCommands, Subscribable<DisplayCommand> {
  public constructor (
    private readonly commands: Publisher<DisplayCommand> & Subscribable<DisplayCommand>,
    private readonly runtimeState: RuntimeStateReader,
    private readonly now: () => Date = () => new Date()
  ) {}

  public showSystem (arguments_: JsonObject) {
    const systemName = this.resolveSystemName(optionalStringArgument(arguments_, 'systemName'))
    const selectedName = optionalStringArgument(arguments_, 'objectName') ?? null
    this.publish('show_system', systemName, selectedName)
    return output(
      selectedName
        ? `Opened ${systemName} and selected ${selectedName} for the commander.`
        : `Opened the ${systemName} system view for the commander.`,
      { displayed: true, systemName, selectedName }
    )
  }

  public showBody (arguments_: JsonObject) {
    const systemName = this.resolveSystemName(optionalStringArgument(arguments_, 'systemName'))
    const bodyName = stringArgument(arguments_, 'bodyName')
    this.publish('show_body', systemName, bodyName)
    return output(`Opened the detailed ${bodyName} view for the commander.`, {
      bodyName,
      displayed: true,
      systemName
    })
  }

  public subscribe (listener: (message: DisplayCommand) => void): Unsubscribe {
    return this.commands.subscribe(listener)
  }

  private publish (type: DisplayCommand['type'], systemName: string, selectedName: string | null): void {
    this.commands.publish(DisplayCommandSchema.parse({
      id: randomUUID(),
      type,
      systemName,
      selectedName,
      createdAt: this.now().toISOString()
    }))
  }

  private resolveSystemName (requested: string | undefined): string {
    const systemName = requested ?? this.runtimeState.getCurrent().system.name
    if (!systemName) throw new Error('The current system is unknown; provide systemName.')
    return systemName
  }
}
