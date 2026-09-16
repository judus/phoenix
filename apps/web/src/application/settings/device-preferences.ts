export interface PhoenixDevicePreferencesSnapshot {
  version: 2
  audioInputId: string
  audioOutputId: string
  captureNumpad: boolean
  currentShipLoadoutView: 'table' | 'tiles'
  followCopilotNavigation: boolean
  presentation: 'phoenix' | 'elite'
  shipCatalogueView: 'dossier' | 'table'
  uiScalePercent: number
  variableCommandLabelSizes: boolean
}

export interface DevicePreferences {
  getSnapshot(): PhoenixDevicePreferencesSnapshot
  update(patch: Partial<Omit<PhoenixDevicePreferencesSnapshot, 'version'>>): void
  subscribe(listener: () => void): () => void
}
