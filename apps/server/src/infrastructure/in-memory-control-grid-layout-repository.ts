import {
  ControlGridLayoutSchema,
  controlDeckConfigurationToControlGridLayout,
  controlGridLayoutToControlDeckConfiguration,
  mergeControlGridLayoutIntoControlDeckConfiguration,
  type ControlGridLayout
} from '@phoenix/contracts'
import {
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
    this.configuration = mergeControlGridLayoutIntoControlDeckConfiguration(
      this.configuration,
      ControlGridLayoutSchema.parse(candidate)
    )
    return this.getLayout()
  }

  public getConfiguration (): ControlDeckConfiguration {
    return structuredClone(this.configuration)
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    this.configuration = ControlDeckConfigurationSchema.parse(candidate)
    return this.getConfiguration()
  }
}
