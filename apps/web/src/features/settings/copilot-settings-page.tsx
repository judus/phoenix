import { useEffect, useState } from 'react'
import {
  Breadcrumbs,
  Button,
  PageFrame,
  PageHeader,
  Section,
  Select,
  SettingRow,
  SettingsList,
  SettingToggle,
  Status,
  TextInput
} from '@phoenix/ui'
import type { CopilotExecutionPermissions, CopilotSettings } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export interface AudioSettingsController {
  devices: {
    inputs: ReadonlyArray<{ id: string, label: string }>
    outputs: ReadonlyArray<{ id: string, label: string }>
  }
  inputId: string
  outputId: string
  setInputId(id: string): void
  setOutputId(id: string): void
}

export function CopilotSettingsPage ({ api, audio }: { api: PhoenixApi, audio: AudioSettingsController }) {
  const [settings, setSettings] = useState<CopilotSettings>()
  const [apiKey, setApiKey] = useState('')
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void api.getCopilotSettings(abort.signal)
      .then(setSettings)
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  const savePermissions = async (permissions: CopilotExecutionPermissions): Promise<void> => {
    setPending('permissions')
    setError(undefined)
    try {
      setSettings(await api.saveCopilotSettings({ permissions }))
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const saveKey = async (): Promise<void> => {
    if (!settings) return
    setPending('api-key')
    setError(undefined)
    try {
      const openAi = await api.saveOpenAiApiKey(apiKey)
      setSettings({ ...settings, openAi })
      setApiKey('')
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const removeKey = async (): Promise<void> => {
    if (!settings) return
    setPending('api-key')
    setError(undefined)
    try {
      const openAi = await api.removeOpenAiApiKey()
      setSettings({ ...settings, openAi })
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const togglePermission = (key: keyof CopilotExecutionPermissions): void => {
    if (!settings) return
    void savePermissions({ ...settings.permissions, [key]: !settings.permissions[key] })
  }

  return (
    <PageFrame className="settings-page">
      <PageHeader
        context={<Breadcrumbs items={[{ label: 'Settings' }, { label: 'Copilot' }]} />}
        description="AI service access, voice devices, and command permissions."
        title="Copilot settings"
      />
      <div className="settings-sections">
        <Section description="The key is stored on the PHOENIX computer, not in this browser." title="OpenAI">
          {!settings
            ? <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading Copilot settings…'}</Status>
            : <SettingsList>
                <SettingRow
                  description={settings.openAi.configured
                    ? `Configured from ${settings.openAi.source}.${settings.openAi.restartRequired ? ' Restart required.' : ''}`
                    : 'Required only for Copilot features.'}
                  scope="Installation"
                  title="API key"
                >
                  <div className="setting-key-action">
                    <TextInput aria-label={settings.openAi.stored ? 'Replacement OpenAI API key' : 'OpenAI API key'} autoComplete="off" placeholder={settings.openAi.stored ? 'Enter replacement key' : 'Enter API key'} type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} />
                    <Button busy={pending === 'api-key'} disabled={apiKey.trim().length < 20} size="sm" variant="primary" onClick={() => void saveKey()}>{settings.openAi.stored ? 'Replace' : 'Save'}</Button>
                    {settings.openAi.stored && <Button disabled={pending !== undefined} size="sm" variant="danger" onClick={() => void removeKey()}>Remove</Button>}
                  </div>
                </SettingRow>
              </SettingsList>}
          {settings?.openAi.restartRequired && <Status tone="warning" wrap>OpenAI configuration changed. Restart PHOENIX to apply it.</Status>}
        </Section>

        <Section description="Stored only in this browser." title="Voice audio">
          <SettingsList>
            <SettingRow description="Browser device names may remain hidden until microphone access is granted." scope="This device" title="Microphone">
              <Select aria-label="Microphone" value={audio.inputId} onChange={event => audio.setInputId(event.target.value)}>
                <option value="">System default</option>
                {audio.devices.inputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Microphone'}</option>)}
              </Select>
            </SettingRow>
            <SettingRow description="Audio output used for Copilot speech." scope="This device" title="Output">
              <Select aria-label="Audio output" value={audio.outputId} onChange={event => audio.setOutputId(event.target.value)}>
                <option value="">System default</option>
                {audio.devices.outputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Audio output'}</option>)}
              </Select>
            </SettingRow>
          </SettingsList>
        </Section>

        <Section description="Copilot receives only the abilities enabled here." title="Command permissions">
          {!settings
            ? <Status tone="muted">Loading permissions…</Status>
            : <SettingsList>
                <SettingRow description="Allow Copilot to execute individual configured game actions." scope="Installation" title="Game actions">
                  <SettingToggle checked={settings.permissions.gameActions} disabled={pending !== undefined} label={settings.permissions.gameActions ? 'On' : 'Off'} onChange={() => togglePermission('gameActions')} />
                </SettingRow>
                <SettingRow description="Allow Copilot to execute recorded command sequences." scope="Installation" title="Macros">
                  <SettingToggle checked={settings.permissions.macros} disabled={pending !== undefined} label={settings.permissions.macros ? 'On' : 'Off'} onChange={() => togglePermission('macros')} />
                </SettingRow>
                <SettingRow description="Allow Copilot to execute commands marked as dangerous." scope="Installation" title="Dangerous actions">
                  <SettingToggle checked={settings.permissions.dangerousActions} disabled={pending !== undefined} label={settings.permissions.dangerousActions ? 'On' : 'Off'} onChange={() => togglePermission('dangerousActions')} />
                </SettingRow>
              </SettingsList>}
        </Section>
        {error && settings && <Status tone="danger">{error}</Status>}
      </div>
    </PageFrame>
  )
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update Copilot settings.'
}
