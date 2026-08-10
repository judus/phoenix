import {
  ControlGridLayoutSchema,
  type ControlGridLayout
} from '@phoenix/contracts'
import type { ControlGridLayoutRepository } from '../domain/system-configuration.js'
import { DEFAULT_CONTROL_GRID_LAYOUT } from './default-control-grid-layout.js'

export class InMemoryControlGridLayoutRepository implements ControlGridLayoutRepository {
  private layout = structuredClone(DEFAULT_CONTROL_GRID_LAYOUT)

  public getLayout (): ControlGridLayout {
    return structuredClone(this.layout)
  }

  public saveLayout (candidate: ControlGridLayout): ControlGridLayout {
    this.layout = ControlGridLayoutSchema.parse(candidate)
    return this.getLayout()
  }
}
