export interface PhoenixDevicePreferencesSnapshot {
  version: 1
  adaptiveNumpadLabels: boolean
  audioInputId: string
  audioOutputId: string
  captureNumpad: boolean
  currentShipLoadoutView: 'table' | 'tiles'
  followCopilotNavigation: boolean
  presentation: 'phoenix' | 'elite'
  shipCatalogueView: 'dossier' | 'table'
  uiScalePercent: number
}

export interface DevicePreferences {
  getSnapshot(): PhoenixDevicePreferencesSnapshot
  update(patch: Partial<Omit<PhoenixDevicePreferencesSnapshot, 'version'>>): void
  subscribe(listener: () => void): () => void
}
