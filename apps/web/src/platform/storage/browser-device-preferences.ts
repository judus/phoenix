import type {
  DevicePreferences,
  PhoenixDevicePreferencesSnapshot
} from '../../application/settings/device-preferences.js'

const DEVICE_PREFERENCES_KEY = 'phoenix.device.preferences'

const defaults: PhoenixDevicePreferencesSnapshot = {
  version: 2,
  audioInputId: '',
  audioOutputId: '',
  captureNumpad: true,
  currentShipLoadoutView: 'tiles',
  followCopilotNavigation: true,
  presentation: 'phoenix',
  shipCatalogueView: 'dossier',
  uiScalePercent: 100,
  variableCommandLabelSizes: true
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export class BrowserDevicePreferences implements DevicePreferences {
  private readonly listeners = new Set<() => void>()
  private snapshot: PhoenixDevicePreferencesSnapshot

  public constructor (private readonly storage: BrowserStorage) {
    this.snapshot = this.read()
  }

  public getSnapshot = (): PhoenixDevicePreferencesSnapshot => this.snapshot

  public update (patch: Partial<Omit<PhoenixDevicePreferencesSnapshot, 'version'>>): void {
    this.snapshot = { ...this.snapshot, ...patch, version: 2 }
    try {
      this.storage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(this.snapshot))
    } catch {
      // Device preferences remain live for this session when storage is unavailable.
    }
    for (const listener of this.listeners) listener()
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private read (): PhoenixDevicePreferencesSnapshot {
    try {
      const raw = this.storage.getItem(DEVICE_PREFERENCES_KEY)
      if (raw) {
        const candidate: unknown = JSON.parse(raw)
        if (isDevicePreferences(candidate)) return candidate
        const migrated = migrateDevicePreferences(candidate)
        if (migrated) {
          this.storage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(migrated))
          return migrated
        }
      }
      return defaults
    } catch {
      return defaults
    }
  }
}

function isDevicePreferences (value: unknown): value is PhoenixDevicePreferencesSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return candidate.version === 2 &&
    typeof candidate.audioInputId === 'string' &&
    typeof candidate.audioOutputId === 'string' &&
    typeof candidate.captureNumpad === 'boolean' &&
    ['table', 'tiles'].includes(candidate.currentShipLoadoutView as string) &&
    typeof candidate.followCopilotNavigation === 'boolean' &&
    ['phoenix', 'elite'].includes(candidate.presentation as string) &&
    ['dossier', 'table'].includes(candidate.shipCatalogueView as string) &&
    typeof candidate.uiScalePercent === 'number' &&
    Number.isInteger(candidate.uiScalePercent) &&
    candidate.uiScalePercent >= 85 && candidate.uiScalePercent <= 125 &&
    typeof candidate.variableCommandLabelSizes === 'boolean'
}

function migrateDevicePreferences (value: unknown): PhoenixDevicePreferencesSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1 || typeof candidate.adaptiveNumpadLabels !== 'boolean') return undefined
  const { adaptiveNumpadLabels, ...retained } = candidate
  const migrated = {
    ...retained,
    version: 2,
    variableCommandLabelSizes: adaptiveNumpadLabels
  }
  return isDevicePreferences(migrated) ? migrated : undefined
}
