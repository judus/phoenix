const ALLOW_REMOTE_DISPLAY_COMMANDS_KEY = 'phoenix.device.allow-remote-display-commands'

export function allowsRemoteDisplayCommands (): boolean {
  try {
    return window.localStorage.getItem(ALLOW_REMOTE_DISPLAY_COMMANDS_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setAllowsRemoteDisplayCommands (allowed: boolean): void {
  try {
    window.localStorage.setItem(ALLOW_REMOTE_DISPLAY_COMMANDS_KEY, String(allowed))
  } catch {
    // Storage can be unavailable in privacy modes. Preserve the safe default.
  }
}
