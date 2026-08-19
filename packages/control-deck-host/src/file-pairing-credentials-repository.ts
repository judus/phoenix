import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PairingCredentials, PairingCredentialsRepository } from '@jdu/control-deck-core'

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

export class FilePairingCredentialsRepository implements PairingCredentialsRepository {
  public constructor (private readonly path: string) {}

  public load (): unknown | null {
    if (!existsSync(this.path)) return null
    restrictPrivateFile(this.path)
    return JSON.parse(readFileSync(this.path, 'utf8'))
  }

  public save (credentials: PairingCredentials): void {
    ensurePrivateDirectory(dirname(this.path))
    const temporary = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, {
      encoding: 'utf8',
      mode: PRIVATE_FILE_MODE
    })
    restrictPrivateFile(temporary)
    renameSync(temporary, this.path)
    restrictPrivateFile(this.path)
  }
}

function ensurePrivateDirectory (path: string): void {
  mkdirSync(path, { mode: PRIVATE_DIRECTORY_MODE, recursive: true })
  if (supportsPosixModes()) chmodSync(path, PRIVATE_DIRECTORY_MODE)
}

function restrictPrivateFile (path: string): void {
  if (supportsPosixModes() && existsSync(path)) chmodSync(path, PRIVATE_FILE_MODE)
}

function supportsPosixModes (): boolean {
  return process.platform !== 'win32'
}
