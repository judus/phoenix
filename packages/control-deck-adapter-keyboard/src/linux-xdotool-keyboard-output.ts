import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import type {
  ControlDeckCommandOperation
} from '@jdu/control-deck-core'
import type { KeyboardCommandConfiguration, KeyboardOutput, KeyboardOutputStatus } from './keyboard-command-adapter.js'

export interface XdotoolCommandRunner {
  run(executable: string, arguments_: string[], environment: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<void>
}

export interface LinuxXdotoolKeyboardOutputOptions {
  environment?: NodeJS.ProcessEnv
  executablePath?: string
  fileIsExecutable?: (path: string) => boolean
  runner?: XdotoolCommandRunner
}

export class LinuxXdotoolKeyboardOutput implements KeyboardOutput {
  private readonly environment: NodeJS.ProcessEnv
  private readonly executablePath: string | null
  private readonly fileIsExecutable: (path: string) => boolean
  private readonly runner: XdotoolCommandRunner
  private sendQueue: Promise<void> = Promise.resolve()

  public constructor (options: LinuxXdotoolKeyboardOutputOptions = {}) {
    this.environment = options.environment ?? process.env
    this.fileIsExecutable = options.fileIsExecutable ?? isExecutable
    this.executablePath = options.executablePath ?? findExecutable(
      'xdotool',
      this.environment,
      this.fileIsExecutable
    )
    this.runner = options.runner ?? new ExecFileXdotoolCommandRunner()
  }

  public getStatus (): KeyboardOutputStatus {
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
      available: true,
      simulated: false,
      detail: `xdotool is ready on X display ${this.environment.DISPLAY}.`,
      platformRequirements: []
    }
  }

  public send (operation: ControlDeckCommandOperation, binding: KeyboardCommandConfiguration, signal?: AbortSignal): Promise<void> {
    const execution = this.sendQueue.then(() => this.sendNow(operation, binding, signal))
    this.sendQueue = execution.catch(() => undefined)
    return execution
  }

  private async sendNow (operation: ControlDeckCommandOperation, binding: KeyboardCommandConfiguration, signal?: AbortSignal): Promise<void> {
    const status = this.getStatus()
    if (!status.available || !this.executablePath) throw new Error(status.detail)

    const keys = normalizeXdotoolBinding(binding)
    const pressed = operation === 'release' ? [...keys] : []
    try {
      if (operation !== 'release') {
        for (const key of keys) {
          signal?.throwIfAborted()
          await this.runner.run(this.executablePath, ['keydown', key], this.environment, signal)
          pressed.push(key)
        }
      }
      if (operation !== 'press') {
        for (const key of [...keys].reverse()) {
          signal?.throwIfAborted()
          await this.runner.run(this.executablePath, ['keyup', key], this.environment, signal)
          pressed.pop()
        }
      }
    } catch (cause) {
      const cleanupErrors = await this.releasePressedKeys(pressed)
      if (cleanupErrors.length === 0) throw cause
      const message = cause instanceof Error ? cause.message : 'xdotool input failed.'
      throw new Error(`${message} Cleanup also failed: ${cleanupErrors.join('; ')}`, { cause })
    }
  }

  private async releasePressedKeys (pressed: string[]): Promise<string[]> {
    if (!this.executablePath) return []
    const signal = AbortSignal.timeout(1_000)
    const errors: string[] = []
    for (const key of [...pressed].reverse()) {
      try {
        await this.runner.run(this.executablePath, ['keyup', key], this.environment, signal)
      } catch (cause) {
        errors.push(cause instanceof Error ? cause.message : `Unable to release ${key}.`)
      }
    }
    return errors
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

function normalizeXdotoolBinding (binding: KeyboardCommandConfiguration): string[] {
  const keys = [
    ...binding.modifiers.map(eliteKeyToXdotoolKey),
    eliteKeyToXdotoolKey(binding.key)
  ]

  if (keys.length > 4) throw new Error(`Unsupported key combination: ${displayBinding(binding)}.`)
  if (keys.some(key => !/^[a-z0-9_]+$/i.test(key))) {
    throw new Error(`Unsafe keyboard binding: ${displayBinding(binding)}.`)
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
  CapsLock: 'Caps_Lock',
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

function unavailable (detail: string): KeyboardOutputStatus {
  return {
    available: false,
    simulated: false,
    detail,
    platformRequirements: ['Linux', 'xdotool', 'X11 or XWayland']
  }
}

function displayBinding (binding: KeyboardCommandConfiguration): string {
  return [...binding.modifiers, binding.key].join('+')
}
