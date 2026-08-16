import type { DisplayCommandPreference } from '../../application/display/display-command-preference.js'

const ALLOW_REMOTE_DISPLAY_COMMANDS_KEY = 'phoenix.device.allow-remote-display-commands'

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export class BrowserDisplayCommandPreference implements DisplayCommandPreference {
  readonly #storage: BrowserStorage

  constructor(storage: BrowserStorage) {
    this.#storage = storage
  }

  allowsRemoteCommands(): boolean {
    try {
      return this.#storage.getItem(ALLOW_REMOTE_DISPLAY_COMMANDS_KEY) !== 'false'
    } catch {
      return true
    }
  }

  setAllowsRemoteCommands(allowed: boolean): void {
    try {
      this.#storage.setItem(ALLOW_REMOTE_DISPLAY_COMMANDS_KEY, String(allowed))
    } catch {
      // Storage may be unavailable in privacy modes. Preserve the enabled default.
    }
  }
}
