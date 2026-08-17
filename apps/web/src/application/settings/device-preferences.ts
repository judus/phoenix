export interface PhoenixDevicePreferencesSnapshot {
  audioInputId: string
  audioOutputId: string
  captureNumpad: boolean
  followCopilotNavigation: boolean
}

export interface DevicePreferences {
  getSnapshot(): PhoenixDevicePreferencesSnapshot
  update(patch: Partial<PhoenixDevicePreferencesSnapshot>): void
  subscribe(listener: () => void): () => void
}
