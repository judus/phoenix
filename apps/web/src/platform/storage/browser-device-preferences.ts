import type {
  DevicePreferences,
  PhoenixDevicePreferencesSnapshot
} from '../../application/settings/device-preferences.js'

const DEVICE_PREFERENCES_KEY = 'phoenix.device.preferences.v1'
const LEGACY_FOLLOW_KEY = 'phoenix.device.allow-remote-display-commands'

const defaults: PhoenixDevicePreferencesSnapshot = {
  audioInputId: '',
  audioOutputId: '',
  captureNumpad: true,
  followCopilotNavigation: true
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export class BrowserDevicePreferences implements DevicePreferences {
  private readonly listeners = new Set<() => void>()
  private snapshot: PhoenixDevicePreferencesSnapshot

  public constructor (private readonly storage: BrowserStorage) {
    this.snapshot = this.read()
  }

  public getSnapshot = (): PhoenixDevicePreferencesSnapshot => this.snapshot

  public update (patch: Partial<PhoenixDevicePreferencesSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
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
        const candidate = JSON.parse(raw) as Partial<PhoenixDevicePreferencesSnapshot>
        return {
          audioInputId: typeof candidate.audioInputId === 'string' ? candidate.audioInputId : '',
          audioOutputId: typeof candidate.audioOutputId === 'string' ? candidate.audioOutputId : '',
          captureNumpad: candidate.captureNumpad !== false,
          followCopilotNavigation: candidate.followCopilotNavigation !== false
        }
      }
      return {
        ...defaults,
        followCopilotNavigation: this.storage.getItem(LEGACY_FOLLOW_KEY) !== 'false'
      }
    } catch {
      return defaults
    }
  }
}
