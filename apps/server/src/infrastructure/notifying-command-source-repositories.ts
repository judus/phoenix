import type { ControlGridLayout, MacroDefinition, MacroLibrary, PhoenixSettings } from '@phoenix/contracts'
import type { CommandCatalogueChange, CommandCatalogueChangeSource } from '../domain/commands.js'
import type { MacroRepository } from '../domain/macros.js'
import type { Publisher } from '../domain/publisher.js'
import type { ControlGridLayoutRepository, SystemSettingsRepository } from '../domain/system-configuration.js'

abstract class NotifyingRepository {
  protected constructor (
    private readonly changes: Publisher<CommandCatalogueChange>,
    private readonly source: CommandCatalogueChangeSource
  ) {}

  protected changed (): void {
    this.changes.publish({ source: this.source })
  }
}

export class NotifyingControlGridLayoutRepository extends NotifyingRepository implements ControlGridLayoutRepository {
  public constructor (
    private readonly delegate: ControlGridLayoutRepository,
    changes: Publisher<CommandCatalogueChange>
  ) {
    super(changes, 'control-layout')
  }

  public getLayout (): ControlGridLayout { return this.delegate.getLayout() }

  public saveLayout (layout: ControlGridLayout): ControlGridLayout {
    const saved = this.delegate.saveLayout(layout)
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
