import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  PairingAccessController as ControlDeckPairingAccessController,
  PairingAttemptLimitError,
  type PairingCredentialStore,
  type PairingCredentials
} from '@phoenix/control-deck/host'
import { ensurePrivateDirectorySync, PRIVATE_FILE_MODE, restrictPrivateFileSync } from './private-user-state.js'

export { PairingAttemptLimitError }

export class PairingAccessController extends ControlDeckPairingAccessController {
  public constructor (credentialsFile: string) {
    super(new JsonPairingCredentialStore(credentialsFile), { cookieName: 'phoenix_session' })
  }
}

class JsonPairingCredentialStore implements PairingCredentialStore {
  public constructor (private readonly path: string) {}

  public load (): unknown | undefined {
    if (!existsSync(this.path)) return undefined
    restrictPrivateFileSync(this.path)
    return JSON.parse(readFileSync(this.path, 'utf8'))
  }

  public save (credentials: PairingCredentials): void {
    ensurePrivateDirectorySync(dirname(this.path))
    const temporary = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: PRIVATE_FILE_MODE })
    restrictPrivateFileSync(temporary)
    renameSync(temporary, this.path)
    restrictPrivateFileSync(this.path)
  }
}
