import { randomUUID } from 'node:crypto'
import type { JsonObject } from '@jdu/llm-client'
import { DisplayCommandSchema, type DisplayCommand } from '@phoenix/contracts'
import type { Publisher, Subscribable, Unsubscribe } from '../domain/publisher.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { DisplayCommands } from './mcp-tools/tool-gateways.js'
import { optionalStringArgument, output, stringArgument } from './mcp-tools/tool-support.js'
import { resolveDisplayPage } from './display-page-catalogue.js'

export class DisplayCommandService implements DisplayCommands, Subscribable<DisplayCommand> {
  public constructor (
    private readonly commands: Publisher<DisplayCommand> & Subscribable<DisplayCommand>,
    private readonly runtimeState: RuntimeStateReader,
    private readonly now: () => Date = () => new Date()
  ) {}

  public openPage (arguments_: JsonObject) {
    const page = resolveDisplayPage(stringArgument(arguments_, 'page'))
    this.commands.publish(DisplayCommandSchema.parse({
      id: randomUUID(),
      type: 'open_page',
      pageId: page.id,
      createdAt: this.now().toISOString()
    }))
    return output(`Opened the PHOENIX ${page.label} page.`, { displayed: true, pageId: page.id })
  }

  public showSystem (arguments_: JsonObject) {
    const systemName = this.resolveSystemName(optionalStringArgument(arguments_, 'systemName'))
    const selectedName = optionalStringArgument(arguments_, 'objectName') ?? null
    this.publishSystem('show_system', systemName, selectedName)
    return output(
      selectedName
        ? `Opened the PHOENIX ${systemName} system schematic and selected ${selectedName}.`
        : `Opened the PHOENIX ${systemName} system schematic.`,
      { displayed: true, systemName, selectedName }
    )
  }

  public showBody (arguments_: JsonObject) {
    const systemName = this.resolveSystemName(optionalStringArgument(arguments_, 'systemName'))
    const bodyName = stringArgument(arguments_, 'bodyName')
    this.publishSystem('show_body', systemName, bodyName)
    return output(`Opened ${bodyName} body details in PHOENIX.`, {
      bodyName,
      displayed: true,
      systemName
    })
  }

  public subscribe (listener: (message: DisplayCommand) => void): Unsubscribe {
    return this.commands.subscribe(listener)
  }

  private publishSystem (type: 'show_system' | 'show_body', systemName: string, selectedName: string | null): void {
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
