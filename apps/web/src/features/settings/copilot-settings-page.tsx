import { useEffect, useRef, useState } from 'react'
import { Notification,
  Breadcrumbs,
  Button,
  PageFrame,
  PageHeader,
  Section,
  Select,
  SettingRow,
  SettingsList,
  Status,
  TextInput
} from '@phoenix/ui'
import type { CopilotAiProvider, CopilotPermissionPolicy, CopilotSettings } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { CopilotPermissionEditor } from '../../components/copilot-permission-editor.js'
import { GalnetAnalysisSettings } from './galnet-analysis-settings.js'

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
  const [model, setModel] = useState('')
  const [permissionsPending, setPermissionsPending] = useState(false)
  const [providerPending, setProviderPending] = useState(false)
  const [keyPending, setKeyPending] = useState(false)
  const pending = permissionsPending || providerPending || keyPending
  const [error, setError] = useState<string>()
  const lifetime = useRef<{ api: PhoenixApi, abort: AbortController } | undefined>(undefined)

  useEffect(() => {
    const abort = new AbortController()
    lifetime.current = { api, abort }
    setPermissionsPending(false)
    setProviderPending(false)
    setKeyPending(false)
    void api.getCopilotSettings(abort.signal)
      .then(result => { if (!abort.signal.aborted) { setSettings(result); setModel(result.model) } })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  const savePermissions = async (permissions: CopilotPermissionPolicy): Promise<void> => {
    const owner = lifetime.current
    if (!settings || !owner || owner.api !== api || owner.abort.signal.aborted) return
    setPermissionsPending(true)
    setError(undefined)
    try {
      const saved = await api.saveCopilotSettings({ provider: settings.provider, model: settings.model, permissions })
      if (!owner.abort.signal.aborted) setSettings(current => ({ ...saved, openAi: current?.openAi ?? saved.openAi,
        providerKey: current?.providerKey ?? saved.providerKey }))
    } catch (cause) {
      if (!owner.abort.signal.aborted) setError(message(cause))
    } finally {
      if (!owner.abort.signal.aborted) setPermissionsPending(false)
    }
  }

  const saveProvider = async (provider: CopilotAiProvider): Promise<void> => {
    const owner = lifetime.current
    if (!settings || !owner || owner.api !== api || owner.abort.signal.aborted) return
    setProviderPending(true)
    setError(undefined)
    try {
      const saved = await api.saveCopilotSettings({ provider, model: '', permissions: settings.permissions })
      if (!owner.abort.signal.aborted) { setSettings(saved); setModel(''); setApiKey('') }
    } catch (cause) {
      if (!owner.abort.signal.aborted) setError(message(cause))
    } finally {
      if (!owner.abort.signal.aborted) setProviderPending(false)
    }
  }

  const saveModel = async (): Promise<void> => {
    const owner = lifetime.current
    if (!settings || !owner || owner.api !== api || owner.abort.signal.aborted) return
    setProviderPending(true)
    setError(undefined)
    try {
      const saved = await api.saveCopilotSettings({ provider: settings.provider, model, permissions: settings.permissions })
      if (!owner.abort.signal.aborted) setSettings(saved)
    } catch (cause) { if (!owner.abort.signal.aborted) setError(message(cause)) }
    finally { if (!owner.abort.signal.aborted) setProviderPending(false) }
  }

  const saveKey = async (): Promise<void> => {
    const owner = lifetime.current
    if (!settings || !owner || owner.api !== api || owner.abort.signal.aborted) return
    setKeyPending(true)
    setError(undefined)
    try {
      const status = settings.provider === 'openai' ? await api.saveOpenAiApiKey(apiKey)
        : await api.saveCopilotProviderKey(settings.provider, apiKey)
      if (owner.abort.signal.aborted) return
      setSettings(current => current ? { ...current, providerKey: status,
        ...(settings.provider === 'openai' ? { openAi: status } : {}) } : current)
      setApiKey(current => current === apiKey ? '' : current)
    } catch (cause) {
      if (!owner.abort.signal.aborted) setError(message(cause))
    } finally {
      if (!owner.abort.signal.aborted) setKeyPending(false)
    }
  }

  const removeKey = async (): Promise<void> => {
    const owner = lifetime.current
    if (!settings || !owner || owner.api !== api || owner.abort.signal.aborted) return
    setKeyPending(true)
    setError(undefined)
    try {
      const status = settings.provider === 'openai' ? await api.removeOpenAiApiKey()
        : await api.removeCopilotProviderKey(settings.provider)
      if (!owner.abort.signal.aborted) setSettings(current => current ? { ...current, providerKey: status,
        ...(settings.provider === 'openai' ? { openAi: status } : {}) } : current)
    } catch (cause) {
      if (!owner.abort.signal.aborted) setError(message(cause))
    } finally {
      if (!owner.abort.signal.aborted) setKeyPending(false)
    }
  }

  return (
    <PageFrame className="settings-page" layout="fit">
      <PageHeader
        context={<Breadcrumbs items={[{ label: 'Settings' }, { label: 'Copilot' }]} />}
        description="AI service access, voice devices, and command permissions."
        title="Copilot settings"
      />
      <div className="settings-sections">
        <Section description="Choose the text Copilot's AI service. Keys stay on the PHOENIX computer. Voice and GalNet currently use OpenAI independently." title="AI provider">
          {!settings
            ? !error && <Status tone="muted">Loading Copilot settings…</Status>
            : <SettingsList>
                <SettingRow description="OpenAI, Anthropic and Google connect directly. Claude and Gemini have not yet been tested with live PHOENIX sessions." scope="Installation" title="Text provider">
                  <Select
                    aria-label="AI provider"
                    disabled={pending}
                    value={settings.provider}
                    onChange={event => void saveProvider(event.target.value as CopilotAiProvider)}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                  </Select>
                </SettingRow>
                <SettingRow description="Enter the exact tool-capable model ID from your provider. For OpenAI, leaving this blank uses the server's configured default. Restart PHOENIX after changing it." scope="Installation" title="Text model">
                  <div className="setting-key-action">
                    <TextInput aria-label="Text model ID" value={model} onChange={event => setModel(event.target.value)} disabled={pending} />
                    <Button size="sm" variant="primary" disabled={pending || model === settings.model} onClick={() => void saveModel()}>Save model</Button>
                  </div>
                </SettingRow>
                <SettingRow
                  description={settings.providerKey.configured
                    ? `Configured from ${settings.providerKey.source}.${settings.providerKey.restartRequired ? ' Restart required.' : ''}`
                    : 'Required for the selected text provider. OpenAI also enables realtime voice and optional GalNet analysis.'}
                  scope="Installation"
                  title="API key"
                >
                  <div className="setting-key-action">
                    <TextInput aria-label={`${settings.providerKey.stored ? 'Replacement ' : ''}${settings.provider === 'openai' ? 'OpenAI' : settings.provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`} autoComplete="off" placeholder={settings.providerKey.stored ? 'Enter replacement key' : 'Enter API key'} type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} />
                    <Button busy={keyPending} disabled={apiKey.trim().length < 20} size="sm" variant="primary" onClick={() => void saveKey()}>{settings.providerKey.stored ? 'Replace' : 'Save'}</Button>
                    {settings.providerKey.stored && <Button disabled={pending} size="sm" variant="danger" onClick={() => void removeKey()}>Remove</Button>}
                  </div>
                </SettingRow>
              </SettingsList>}
          <Notification tone="warning" message={settings?.restartRequired || settings?.providerKey.restartRequired ? 'AI configuration changed. Restart PHOENIX to apply it.' : undefined} />
        </Section>

        <GalnetAnalysisSettings api={api} />

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

        <Section description="Installation-wide permission ceiling. Each Copilot profile chooses its own capabilities within this limit; its AI load is shown in Profiles. Disabled capabilities are hidden from Copilot and rejected at execution time." title="Capabilities">
          {!settings
            ? <Status tone="muted">Loading permissions…</Status>
            : <CopilotPermissionEditor
                capabilities={settings.capabilities}
                disabled={pending}
                permissions={settings.permissions}
                onChange={permissions => void savePermissions(permissions)}
              />}
        </Section>
        <Notification message={error} />
      </div>
    </PageFrame>
  )
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update Copilot settings.'
}
