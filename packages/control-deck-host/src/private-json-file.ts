import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

export function readPrivateJsonFile (path: string): unknown | null {
  if (!existsSync(path)) return null
  restrictPrivateFile(path)
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function writePrivateJsonFile (path: string, value: unknown): void {
  ensurePrivateDirectory(dirname(path))
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: PRIVATE_FILE_MODE
  })
  restrictPrivateFile(temporary)
  renameSync(temporary, path)
  restrictPrivateFile(path)
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
