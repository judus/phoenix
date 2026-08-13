import {
  CommandCatalogResponseSchema,
  CommandCatalogueSnapshotSchema,
  commandTargetKey,
  type CommandCatalogueSnapshot,
  type CommandDescriptor,
  type CommandTarget
} from '@phoenix/contracts'
import type {
  CommandCatalogueChange,
  CommandCatalogueSnapshots,
  CommandRegistry
} from '../domain/commands.js'
import type { Subscribable } from '../domain/publisher.js'
import { InProcessPublisher } from '../infrastructure/in-process-publisher.js'

export class CommandCatalogueService implements CommandCatalogueSnapshots {
  private revision = 0
  private snapshot: CommandCatalogueSnapshot
  private readonly updates = new InProcessPublisher<CommandCatalogueSnapshot>()

  public constructor (
    private readonly registry: CommandRegistry,
    changes?: Subscribable<CommandCatalogueChange>,
    private readonly now: () => Date = () => new Date()
  ) {
    this.snapshot = this.rebuild()
    changes?.subscribe(change => { this.invalidate(change) })
  }

  public find (target: CommandTarget): CommandDescriptor | undefined {
    const key = commandTargetKey(target)
    return this.snapshot.commands.find(command => commandTargetKey(command.target) === key)
  }

  public getCatalog () {
    return CommandCatalogResponseSchema.parse({ commands: this.snapshot.commands })
  }

  public getSnapshot (): CommandCatalogueSnapshot {
    return CommandCatalogueSnapshotSchema.parse(this.snapshot)
  }

  public invalidate (_change: CommandCatalogueChange): CommandCatalogueSnapshot {
    this.snapshot = this.rebuild()
    this.updates.publish(this.getSnapshot())
    return this.getSnapshot()
  }

  public subscribe (listener: (snapshot: CommandCatalogueSnapshot) => void): () => void {
    return this.updates.subscribe(listener)
  }

  private rebuild (): CommandCatalogueSnapshot {
    this.revision += 1
    return CommandCatalogueSnapshotSchema.parse({
      revision: this.revision,
      generatedAt: this.now().toISOString(),
      commands: this.registry.getCatalog().commands
    })
  }
}
