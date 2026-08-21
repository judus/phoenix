import {
  ControlGridLayoutSchema,
  controlDeckConfigurationToControlGridLayout,
  controlGridLayoutToControlDeckConfiguration,
  mergeControlGridLayoutIntoControlDeckConfiguration,
  type ControlGridLayout
} from '@phoenix/contracts'
import {
  ControlDeckConfigurationConflictError,
  ControlDeckConfigurationSchema,
  type ControlDeckConfiguration
} from '@jdu/control-deck-core'
import type { ControlGridLayoutRepository } from '../domain/system-configuration.js'
import { DEFAULT_CONTROL_GRID_LAYOUT } from './default-control-grid-layout.js'

export class InMemoryControlGridLayoutRepository implements ControlGridLayoutRepository {
  private configuration = controlGridLayoutToControlDeckConfiguration(DEFAULT_CONTROL_GRID_LAYOUT)

  public getLayout (): ControlGridLayout {
    return controlDeckConfigurationToControlGridLayout(this.configuration)
  }

  public saveLayout (candidate: ControlGridLayout): ControlGridLayout {
    this.saveConfiguration(mergeControlGridLayoutIntoControlDeckConfiguration(
      this.configuration,
      ControlGridLayoutSchema.parse(candidate)
    ))
    return this.getLayout()
  }

  public getConfiguration (): ControlDeckConfiguration {
    return structuredClone(this.configuration)
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    const configuration = ControlDeckConfigurationSchema.parse(candidate)
    if (configuration.revision !== this.configuration.revision) throw new ControlDeckConfigurationConflictError()
    this.configuration = ControlDeckConfigurationSchema.parse({
      ...configuration,
      revision: this.configuration.revision + 1
    })
    return this.getConfiguration()
  }
}
