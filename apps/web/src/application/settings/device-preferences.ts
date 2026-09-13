export interface PhoenixDevicePreferencesSnapshot {
  audioInputId: string
  audioOutputId: string
  captureNumpad: boolean
  currentShipLoadoutView: 'table' | 'tiles'
  followCopilotNavigation: boolean
  shipCatalogueView: 'dossier' | 'table'
  variableNumpadFontSizes: boolean
}

export interface DevicePreferences {
  getSnapshot(): PhoenixDevicePreferencesSnapshot
  update(patch: Partial<PhoenixDevicePreferencesSnapshot>): void
  subscribe(listener: () => void): () => void
}
