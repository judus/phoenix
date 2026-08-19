import type { KeyboardOutput, KeyboardOutputStatus } from './keyboard-command-adapter.js'
import { LinuxXdotoolKeyboardOutput } from './linux-xdotool-keyboard-output.js'
import { WindowsSendInputKeyboardOutput } from './windows-sendinput-keyboard-output.js'

export interface PlatformKeyboardOutputOptions {
  platform?: NodeJS.Platform
}

export function createPlatformKeyboardOutput (options: PlatformKeyboardOutputOptions = {}): KeyboardOutput {
  const platform = options.platform ?? process.platform
  if (platform === 'linux') return new LinuxXdotoolKeyboardOutput()
  if (platform === 'win32') return new WindowsSendInputKeyboardOutput({ platform })
  return new UnavailablePlatformKeyboardOutput(platform)
}

class UnavailablePlatformKeyboardOutput implements KeyboardOutput {
  public constructor (private readonly platform: NodeJS.Platform) {}

  public getStatus (): KeyboardOutputStatus {
    return {
      available: false,
      detail: `Control Deck has no keyboard output for platform ${this.platform}.`,
      platformRequirements: ['Linux with xdotool, or Windows with Windows PowerShell'],
      simulated: false
    }
  }

  public send (): Promise<void> {
    return Promise.reject(new Error(this.getStatus().detail))
  }
}
