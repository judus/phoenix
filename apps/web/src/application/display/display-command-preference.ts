export interface DisplayCommandPreference {
  allowsRemoteCommands(): boolean
  setAllowsRemoteCommands(allowed: boolean): void
}
