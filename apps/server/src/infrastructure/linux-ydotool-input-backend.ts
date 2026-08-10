import { execFile, spawnSync } from 'node:child_process'
import { constants, existsSync, accessSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'
import { eliteKeyToLinuxCode } from './linux-input-key-codes.js'

export interface ProcessCommandRunner {
  run(executable: string, arguments_: string[], environment: NodeJS.ProcessEnv): Promise<void>
}

export interface LinuxYdotoolInputBackendOptions {
  environment?: NodeJS.ProcessEnv
  executablePath?: string
  fileExists?: (path: string) => boolean
  runner?: ProcessCommandRunner
  socketPath?: string
  versionProbe?: (executable: string) => string | null
}

export class LinuxYdotoolInputBackend implements InputBackend {
  private readonly environment: NodeJS.ProcessEnv
  private readonly executablePath: string | null
  private readonly fileExists: (path: string) => boolean
  private readonly runner: ProcessCommandRunner
  private readonly socketPath: string | null
  private readonly version: string | null

  public constructor (options: LinuxYdotoolInputBackendOptions = {}) {
    this.environment = options.environment ?? process.env
    this.fileExists = options.fileExists ?? existsSync
    this.executablePath = options.executablePath ?? findExecutable('ydotool', this.environment)
    this.socketPath = options.socketPath ?? resolveSocketPath(this.environment, this.fileExists)
    this.runner = options.runner ?? new ExecFileCommandRunner()
    this.version = this.executablePath
      ? (options.versionProbe ?? probeVersion)(this.executablePath)
      : null
  }

  public getStatus (): InputBackendStatus {
    if (process.platform !== 'linux') {
      return unavailable('The ydotool backend is available only on Linux.')
    }
    if (!this.executablePath || !this.fileExists(this.executablePath)) {
      return unavailable('ydotool 1.x is not installed; recording input remains active unless explicitly changed.')
    }
    if (!this.version?.match(/^1\.\d+(?:\.\d+)?$/)) {
      return unavailable(`ydotool 1.x is required; detected ${this.version ?? 'an unknown version'}.`)
    }
    if (!this.socketPath || !this.fileExists(this.socketPath)) {
      return unavailable('ydotoold is not reachable; start its user-owned socket before enabling live input.')
    }
    return {
      id: 'linux-ydotool',
      available: true,
      simulated: false,
      detail: `ydotool ${this.version} is connected through ${this.socketPath}.`
    }
  }

  public async send (operation: GameActionOperation, binding: LogicalInputChord): Promise<void> {
    const status = this.getStatus()
    if (!status.available || !this.executablePath || !this.socketPath) throw new Error(status.detail)
    const codes = [...binding.modifiers, binding.key].map(eliteKeyToLinuxCode)
    const arguments_ = ['key', ...keyEvents(operation, codes)]
    await this.runner.run(this.executablePath, arguments_, {
      ...this.environment,
      YDOTOOL_SOCKET: this.socketPath
    })
  }
}

export class ExecFileCommandRunner implements ProcessCommandRunner {
  public async run (
    executable: string,
    arguments_: string[],
    environment: NodeJS.ProcessEnv
  ): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      execFile(executable, arguments_, { env: environment, timeout: 5_000 }, (error, _stdout, stderr) => {
        if (!error) {
          resolvePromise()
          return
        }
        const detail = stderr.trim() || error.message
        reject(new Error(`ydotool input failed: ${detail}`))
      })
    })
  }
}

function keyEvents (operation: GameActionOperation, codes: number[]): string[] {
  const key = codes.at(-1)
  if (key === undefined) throw new Error('No Linux keycode was resolved.')
  const modifiers = codes.slice(0, -1)
  if (operation === 'press') return [...modifiers, key].map(code => `${code}:1`)
  if (operation === 'release') return [key, ...modifiers.reverse()].map(code => `${code}:0`)
  return [
    ...modifiers.map(code => `${code}:1`),
    `${key}:1`,
    `${key}:0`,
    ...modifiers.reverse().map(code => `${code}:0`)
  ]
}

function findExecutable (name: string, environment: NodeJS.ProcessEnv): string | null {
  for (const directory of (environment.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, name)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {}
  }
  return null
}

function resolveSocketPath (
  environment: NodeJS.ProcessEnv,
  fileExists: (path: string) => boolean
): string | null {
  const runtimeDirectory = environment.XDG_RUNTIME_DIR
  if (environment.YDOTOOL_SOCKET) return environment.YDOTOOL_SOCKET
  const candidates = [
    runtimeDirectory ? join(runtimeDirectory, '.ydotool_socket') : undefined,
    '/tmp/.ydotool_socket'
  ].filter((candidate): candidate is string => Boolean(candidate))
  return candidates.find(fileExists) ?? candidates[0] ?? null
}

function probeVersion (executable: string): string | null {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 1_000 })
  const output = `${result.stdout ?? ''} ${result.stderr ?? ''}`.trim()
  return output.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null
}

function unavailable (detail: string): InputBackendStatus {
  return {
    id: 'linux-ydotool',
    available: false,
    simulated: false,
    detail
  }
}
