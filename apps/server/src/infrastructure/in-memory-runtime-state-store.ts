import {
  RuntimeStateSchema,
  createEmptyRuntimeState,
  type RuntimeState
} from '@phoenix/contracts'
import type { RuntimeStateReader, RuntimeStateWriter } from '../domain/runtime-state.js'

export class InMemoryRuntimeStateStore implements RuntimeStateReader, RuntimeStateWriter {
  private state: RuntimeState = createEmptyRuntimeState()

  public getCurrent (): RuntimeState {
    return structuredClone(this.state)
  }

  public replace (state: RuntimeState): void {
    this.state = RuntimeStateSchema.parse(state)
  }
}
