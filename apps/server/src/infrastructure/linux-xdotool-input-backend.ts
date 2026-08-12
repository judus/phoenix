import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'

export interface XdotoolCommandRunner {
  run(executable: string, arguments_: string[], environment: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<void>
}

export interface LinuxXdotoolInputBackendOptions {
  environment?: NodeJS.ProcessEnv
  executablePath?: string
  fileIsExecutable?: (path: string) => boolean
  runner?: XdotoolCommandRunner
}

export class LinuxXdotoolInputBackend implements InputBackend {
  private readonly environment: NodeJS.ProcessEnv
  private readonly executablePath: string | null
  private readonly fileIsExecutable: (path: string) => boolean
  private readonly runner: XdotoolCommandRunner

  public constructor (options: LinuxXdotoolInputBackendOptions = {}) {
    this.environment = options.environment ?? process.env
    this.fileIsExecutable = options.fileIsExecutable ?? isExecutable
    this.executablePath = options.executablePath ?? findExecutable(
      'xdotool',
      this.environment,
      this.fileIsExecutable
    )
    this.runner = options.runner ?? new ExecFileXdotoolCommandRunner()
  }

  public getStatus (): InputBackendStatus {
    if (process.platform !== 'linux') {
      return unavailable('The xdotool backend is available only on Linux.')
    }
    if (!this.executablePath || !this.fileIsExecutable(this.executablePath)) {
      return unavailable('xdotool is not installed or is not executable.')
    }
    if (!this.environment.DISPLAY) {
      return unavailable('No X11 display is available. The xdotool backend requires X11 or XWayland.')
    }
    return {
      id: 'linux-xdotool',
      available: true,
      simulated: false,
      detail: `xdotool is ready on X display ${this.environment.DISPLAY}.`
    }
  }

  public async send (operation: GameActionOperation, binding: LogicalInputChord, signal?: AbortSignal): Promise<void> {
    const status = this.getStatus()
    if (!status.available || !this.executablePath) throw new Error(status.detail)

    const keys = normalizeXdotoolBinding(binding)
    const commands = operation === 'tap'
      ? [...keyCommands('keydown', keys), ...keyCommands('keyup', keys)]
      : keyCommands(operation === 'press' ? 'keydown' : 'keyup', keys)

    for (const arguments_ of commands) {
      signal?.throwIfAborted()
      await this.runner.run(this.executablePath, arguments_, this.environment, signal)
    }
  }
}

export class ExecFileXdotoolCommandRunner implements XdotoolCommandRunner {
  public async run (
    executable: string,
    arguments_: string[],
    environment: NodeJS.ProcessEnv,
    signal?: AbortSignal
  ): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      execFile(executable, arguments_, { env: environment, timeout: 5_000, signal }, (error, _stdout, stderr) => {
        if (!error) {
          resolvePromise()
          return
        }
        const detail = stderr.trim() || error.message
        reject(new Error(`xdotool input failed: ${detail}`))
      })
    })
  }
}

function keyCommands (command: 'keydown' | 'keyup', keys: string[]): string[][] {
  const orderedKeys = command === 'keyup' ? [...keys].reverse() : keys
  return orderedKeys.map(key => [command, key])
}

function normalizeXdotoolBinding (binding: LogicalInputChord): string[] {
  const keys = [
    ...binding.modifiers.map(eliteKeyToXdotoolKey),
    eliteKeyToXdotoolKey(binding.key)
  ]

  if (keys.length > 4) throw new Error(`Unsupported key combination: ${binding.display}.`)
  if (keys.some(key => !/^[a-z0-9_]+$/i.test(key))) {
    throw new Error(`Unsafe Elite keyboard binding: ${binding.display}.`)
  }
  return keys
}

function eliteKeyToXdotoolKey (key: string): string {
  if (key.length === 1) return key.toLowerCase()

  const translated = XDOTOOL_KEYS[key]
  if (translated) return translated
  return key
}

const XDOTOOL_KEYS: Readonly<Record<string, string>> = {
  BackSlash: 'backslash',
  BackSpace: 'BackSpace',
  Comma: 'comma',
  Delete: 'Delete',
  DownArrow: 'Down',
  End: 'End',
  Enter: 'Return',
  Equals: 'equal',
  Escape: 'Escape',
  ForwardSlash: 'slash',
  Home: 'Home',
  Insert: 'Insert',
  LeftAlt: 'alt',
  LeftArrow: 'Left',
  LeftControl: 'ctrl',
  LeftShift: 'shift',
  Minus: 'minus',
  Numpad_0: 'KP_0',
  Numpad_1: 'KP_1',
  Numpad_2: 'KP_2',
  Numpad_3: 'KP_3',
  Numpad_4: 'KP_4',
  Numpad_5: 'KP_5',
  Numpad_6: 'KP_6',
  Numpad_7: 'KP_7',
  Numpad_8: 'KP_8',
  Numpad_9: 'KP_9',
  Numpad_Add: 'KP_Add',
  Numpad_Decimal: 'KP_Decimal',
  Numpad_Divide: 'KP_Divide',
  Numpad_Enter: 'KP_Enter',
  Numpad_Multiply: 'KP_Multiply',
  Numpad_Subtract: 'KP_Subtract',
  PageDown: 'Page_Down',
  PageUp: 'Page_Up',
  Period: 'period',
  RightAlt: 'alt',
  RightArrow: 'Right',
  RightControl: 'ctrl',
  RightShift: 'shift',
  Space: 'space',
  Tab: 'Tab',
  UpArrow: 'Up'
}

function findExecutable (
  name: string,
  environment: NodeJS.ProcessEnv,
  fileIsExecutable: (path: string) => boolean
): string | null {
  for (const directory of (environment.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, name)
    if (fileIsExecutable(candidate)) return candidate
  }
  return null
}

function isExecutable (path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function unavailable (detail: string): InputBackendStatus {
  return {
    id: 'linux-xdotool',
    available: false,
    simulated: false,
    detail
  }
}
