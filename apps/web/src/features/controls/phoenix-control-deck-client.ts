import type {
  ControlDeckCommandOperation,
  ControlDeckCommandTarget,
  ControlDeckConfiguration
} from '@jdu/control-deck-core'
import type { ControlDeckClient } from '@jdu/control-deck-ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export class PhoenixControlDeckClient implements ControlDeckClient {
  public constructor (private readonly api: PhoenixApi) {}

  public commands () { return this.api.getControlDeckCommands() }
  public configuration () { return this.api.getControlDeckConfiguration() }
  public execute (target: ControlDeckCommandTarget, operation: ControlDeckCommandOperation, leaseId?: string) {
    return this.api.executeControlDeckCommand(target, operation, leaseId)
  }
  public saveConfiguration (configuration: ControlDeckConfiguration) {
    return this.api.saveControlDeckConfiguration(configuration)
  }
}
