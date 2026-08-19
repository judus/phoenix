import type { PairingCredentials, PairingCredentialsRepository } from '@jdu/control-deck-core'
import { readPrivateJsonFile, writePrivateJsonFile } from './private-json-file.js'

export class FilePairingCredentialsRepository implements PairingCredentialsRepository {
  public constructor (private readonly path: string) {}

  public load (): unknown | null {
    return readPrivateJsonFile(this.path)
  }

  public save (credentials: PairingCredentials): void {
    writePrivateJsonFile(this.path, credentials)
  }
}
