import {
  ControlDeckConfigurationConflictError,
  type ControlDeckConfiguration,
  type ControlDeckConfigurationRepository
} from 'control-deck/core'
import { PhoenixControlDeckConfigurationSchema } from '@phoenix/contracts'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from './default-control-deck-configuration.js'

export class InMemoryControlDeckConfigurationRepository implements ControlDeckConfigurationRepository {
  private configuration = PhoenixControlDeckConfigurationSchema.parse(DEFAULT_CONTROL_DECK_CONFIGURATION)

  public getConfiguration (): ControlDeckConfiguration {
    return PhoenixControlDeckConfigurationSchema.parse(this.configuration)
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    const configuration = PhoenixControlDeckConfigurationSchema.parse(candidate)
    if (configuration.revision !== this.configuration.revision) throw new ControlDeckConfigurationConflictError()
    this.configuration = PhoenixControlDeckConfigurationSchema.parse({
      ...configuration,
      revision: this.configuration.revision + 1
    })
    return this.getConfiguration()
  }
}
