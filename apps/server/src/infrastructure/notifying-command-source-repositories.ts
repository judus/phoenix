import type { MacroDefinition, MacroLibrary, PhoenixSettings } from '@phoenix/contracts'
import type { ControlDeckConfiguration, ControlDeckConfigurationRepository } from 'control-deck/core'
import type { CommandCatalogueChange, CommandCatalogueChangeSource } from '../domain/commands.js'
import type { MacroRepository } from '../domain/macros.js'
import type { Publisher } from '../domain/publisher.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'

abstract class NotifyingRepository {
  protected constructor (
    private readonly changes: Publisher<CommandCatalogueChange>,
    private readonly source: CommandCatalogueChangeSource
  ) {}

  protected changed (): void {
    this.changes.publish({ source: this.source })
  }
}

export class NotifyingControlDeckConfigurationRepository extends NotifyingRepository implements ControlDeckConfigurationRepository {
  public constructor (
    private readonly delegate: ControlDeckConfigurationRepository,
    changes: Publisher<CommandCatalogueChange>
  ) {
    super(changes, 'control-deck')
  }

  public getConfiguration (): ControlDeckConfiguration { return this.delegate.getConfiguration() }

  public saveConfiguration (configuration: ControlDeckConfiguration): ControlDeckConfiguration {
    const saved = this.delegate.saveConfiguration(configuration)
    this.changed()
    return saved
  }
}

export class NotifyingMacroRepository extends NotifyingRepository implements MacroRepository {
  public constructor (
    private readonly delegate: MacroRepository,
    changes: Publisher<CommandCatalogueChange>
  ) {
    super(changes, 'macros')
  }

  public delete (id: string): void {
    this.delegate.delete(id)
    this.changed()
  }

  public get (id: string): MacroDefinition | undefined { return this.delegate.get(id) }
  public getLibrary (): MacroLibrary { return this.delegate.getLibrary() }

  public save (definition: MacroDefinition): MacroDefinition {
    const saved = this.delegate.save(definition)
    this.changed()
    return saved
  }
}

export class NotifyingSystemSettingsRepository extends NotifyingRepository implements SystemSettingsRepository {
  public constructor (
    private readonly delegate: SystemSettingsRepository,
    changes: Publisher<CommandCatalogueChange>
  ) {
    super(changes, 'module-settings')
  }

  public loadOrCreate (): PhoenixSettings { return this.delegate.loadOrCreate() }

  public save (settings: PhoenixSettings): void {
    this.delegate.save(settings)
    this.changed()
  }
}
