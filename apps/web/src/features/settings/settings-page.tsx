import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Breadcrumbs,
  Button,
  NumberInput,
  PageFrame,
  PageHeader,
  Section,
  Select,
  SettingRow,
  SettingsList,
  SettingToggle,
  Status
} from '@phoenix/ui'
import type { GeneralSettings, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'

export function SettingsPage ({ api, devicePreferences }: { api: PhoenixApi, devicePreferences: DevicePreferences }) {
  const preferences = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.getSnapshot, devicePreferences.getSnapshot)
  const [settings, setSettings] = useState<GeneralSettings>()
  const [modules, setModules] = useState<PhoenixModules>()
  const [threshold, setThreshold] = useState(90)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void Promise.all([api.getGeneralSettings(abort.signal), api.getModuleSettings(abort.signal)])
      .then(([nextSettings, nextModules]) => {
        setSettings(nextSettings)
        setModules(nextModules)
        setThreshold(nextModules.currentShip.moduleHealthAlertThreshold)
      })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  const saveControls = async (enabled: boolean): Promise<void> => {
    setPending('controls')
    setError(undefined)
    try {
      setSettings(await api.saveGeneralSettings({ controlsEnabled: enabled }))
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const saveThreshold = async (): Promise<void> => {
    if (!modules) return
    setPending('threshold')
    setError(undefined)
    try {
      const saved = await api.saveModuleSettings({
        ...modules,
        currentShip: { moduleHealthAlertThreshold: threshold }
      })
      setModules(saved)
      setThreshold(saved.currentShip.moduleHealthAlertThreshold)
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  return (
    <PageFrame className="settings-page">
      <PageHeader
        context={<Breadcrumbs items={[{ label: 'Settings' }, { label: 'General' }]} />}
        description="Application appearance, local device behavior, and shared game integration."
        title="General settings"
      />
      <div className="settings-sections">
        <Section description="Stored only in this browser." title="Appearance">
          <SettingsList>
            <SettingRow description="Use PHOENIX's compact interface or the larger Elite-inspired presentation." scope="This device" title="Presentation">
              <Select aria-label="Presentation" value={preferences.presentation} onChange={event => devicePreferences.update({ presentation: event.target.value as 'phoenix' | 'elite' })}>
                <option value="phoenix">PHOENIX</option>
                <option value="elite">Elite</option>
              </Select>
            </SettingRow>
            <SettingRow description="Scale the complete interface, including application chrome." scope="This device" title="UI scale">
              <div className="setting-range">
                <input
                  aria-label="UI scale"
                  max="125"
                  min="85"
                  step="5"
                  type="range"
                  value={preferences.uiScalePercent}
                  onChange={event => devicePreferences.update({ uiScalePercent: Number(event.target.value) })}
                />
                <output>{preferences.uiScalePercent}%</output>
              </div>
            </SettingRow>
            <SettingRow description="Reduce long Numpy labels to fit their buttons." scope="This device" title="Adaptive Numpy labels">
              <SettingToggle
                checked={preferences.adaptiveNumpadLabels}
                label={preferences.adaptiveNumpadLabels ? 'On' : 'Off'}
                onChange={() => devicePreferences.update({ adaptiveNumpadLabels: !preferences.adaptiveNumpadLabels })}
              />
            </SettingRow>
          </SettingsList>
        </Section>

        <Section description="Behavior specific to this browser or tablet." title="This device">
          <SettingsList>
            <SettingRow description="Open pages on this screen when Copilot navigates through PHOENIX." scope="This device" title="Follow Copilot navigation">
              <SettingToggle checked={preferences.followCopilotNavigation} label={preferences.followCopilotNavigation ? 'On' : 'Off'} onChange={() => devicePreferences.update({ followCopilotNavigation: !preferences.followCopilotNavigation })} />
            </SettingRow>
            <SettingRow description="Reserve this keyboard's physical numpad for PHOENIX shortcuts." scope="This device" title="Capture numpad">
              <SettingToggle checked={preferences.captureNumpad} label={preferences.captureNumpad ? 'On' : 'Off'} onChange={() => devicePreferences.update({ captureNumpad: !preferences.captureNumpad })} />
            </SettingRow>
          </SettingsList>
        </Section>

        <Section description="Shared by every paired device." title="Game integration">
          {!settings || !modules
            ? <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading installation settings…'}</Status>
            : <SettingsList>
                <SettingRow description="Allow PHOENIX to send configured inputs to Elite. A restart may be required." scope="Installation" title="Game controls">
                  <SettingToggle checked={settings.controlsEnabled} disabled={pending !== undefined} label={settings.controlsEnabled ? 'On' : 'Off'} onChange={() => void saveControls(!settings.controlsEnabled)} />
                </SettingRow>
                <SettingRow description="Show ship modules whose reported health is at or below this percentage." scope="Installation" title="Module health warning">
                  <div className="setting-number-action">
                    <NumberInput aria-label="Module health warning threshold" max={99} min={1} step={1} value={threshold} onChange={event => setThreshold(Math.max(1, Math.min(99, Number(event.target.value))))} />
                    <span>%</span>
                    <Button busy={pending === 'threshold'} disabled={threshold === modules.currentShip.moduleHealthAlertThreshold} size="sm" variant="outline" onClick={() => void saveThreshold()}>Save</Button>
                  </div>
                </SettingRow>
              </SettingsList>}
          {error && settings && modules && <Status tone="danger">{error}</Status>}
        </Section>
      </div>
    </PageFrame>
  )
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update settings.'
}
