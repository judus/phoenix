import {
  ControlDeckConfigurationSchema,
  type ControlDeckConfiguration,
  type ControlDeckConfigurationRepository
} from '@jdu/control-deck-core'
import { readPrivateJsonFile, writePrivateJsonFile } from './private-json-file.js'

const EMPTY_CONFIGURATION: ControlDeckConfiguration = {
  version: 1,
  decks: [],
  displays: []
}

export class FileControlDeckConfigurationRepository implements ControlDeckConfigurationRepository {
  public constructor (private readonly path: string) {}

  public getConfiguration (): ControlDeckConfiguration {
    const candidate = readPrivateJsonFile(this.path)
    if (candidate !== null) return ControlDeckConfigurationSchema.parse(candidate)
    writePrivateJsonFile(this.path, EMPTY_CONFIGURATION)
    return structuredClone(EMPTY_CONFIGURATION)
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    const configuration = ControlDeckConfigurationSchema.parse(candidate)
    writePrivateJsonFile(this.path, configuration)
    return this.getConfiguration()
  }
}
