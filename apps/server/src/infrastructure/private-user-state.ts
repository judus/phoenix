import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { chmod, mkdir } from 'node:fs/promises'

export const PRIVATE_DIRECTORY_MODE = 0o700
export const PRIVATE_FILE_MODE = 0o600

export function ensurePrivateDirectorySync (path: string): void {
  mkdirSync(path, { mode: PRIVATE_DIRECTORY_MODE, recursive: true })
  if (supportsPosixModes()) chmodSync(path, PRIVATE_DIRECTORY_MODE)
}

export async function ensurePrivateDirectory (path: string): Promise<void> {
  await mkdir(path, { mode: PRIVATE_DIRECTORY_MODE, recursive: true })
  if (supportsPosixModes()) await chmod(path, PRIVATE_DIRECTORY_MODE)
}

export function restrictPrivateFileSync (path: string): void {
  if (supportsPosixModes() && existsSync(path)) chmodSync(path, PRIVATE_FILE_MODE)
}

export async function restrictPrivateFile (path: string): Promise<void> {
  if (supportsPosixModes()) await chmod(path, PRIVATE_FILE_MODE)
}

function supportsPosixModes (): boolean {
  return process.platform !== 'win32'
}
