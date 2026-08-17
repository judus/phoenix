import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Button,
  DescriptionItem,
  DescriptionList,
  Field,
  Form,
  FormActions,
  FormGrid,
  FormSection,
  PageFrame,
  PageHeader,
  Select,
  Status,
  TextInput,
  ToggleButton
} from '@phoenix/ui'
import type { InstallationSettings, PairingStatus } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import { useCopilotVoice } from '../copilot/copilot-voice-provider.js'

export type SettingsView = 'copilot' | 'audio' | 'device' | 'controls' | 'pairing'

export function SettingsPage ({
  api,
  devicePreferences,
  view
}: {
  api: PhoenixApi
  devicePreferences: DevicePreferences
  view: SettingsView
}) {
  const [settings, setSettings] = useState<InstallationSettings>()
  const [pairing, setPairing] = useState<PairingStatus>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void Promise.all([api.getInstallationSettings(abort.signal), api.getPairingStatus(abort.signal)])
      .then(([nextSettings, nextPairing]) => {
        setSettings(nextSettings)
        setPairing(nextPairing)
      })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  if (error) return <PageFrame><Status tone="danger">{error}</Status></PageFrame>
  if (!settings || !pairing) return <PageFrame><Status tone="muted">Loading settings…</Status></PageFrame>

  const updateSettings = async (next: InstallationSettings): Promise<void> => {
    try {
      setError(undefined)
      setSettings(await api.saveInstallationSettings({
        controlsEnabled: next.controlsEnabled,
        copilotPermissions: next.copilotPermissions
      }))
    } catch (cause) {
      setError(message(cause))
    }
  }

  return (
    <PageFrame layout="fit">
      <PageHeader context="Settings" title={title(view)} />
      {view === 'copilot' && <CopilotSettings api={api} settings={settings} onChange={setSettings} />}
      {view === 'audio' && <AudioSettings />}
      {view === 'device' && <DeviceSettings preferences={devicePreferences} />}
      {view === 'controls' && <ControlSettings settings={settings} onSave={updateSettings} />}
      {view === 'pairing' && <PairingSettings api={api} pairing={pairing} />}
    </PageFrame>
  )
}

function CopilotSettings ({ api, settings, onChange }: {
  api: PhoenixApi
  settings: InstallationSettings
  onChange(settings: InstallationSettings): void
}) {
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const status = settings.openAi

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const openAi = await api.saveOpenAiApiKey(apiKey)
      onChange({ ...settings, openAi })
      setApiKey('')
    } catch (cause) {
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const openAi = await api.removeOpenAiApiKey()
      onChange({ ...settings, openAi })
    } catch (cause) {
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  return <Form onSubmit={event => { event.preventDefault(); void save() }}>
    <FormSection
      title="OpenAI"
      description="The key is stored by the PHOENIX server and is never returned to this browser."
    >
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Status" value={status.configured ? 'Configured' : 'Not configured'} />
        <DescriptionItem label="Source" value={status.source} />
        <DescriptionItem label="Restart" value={status.restartRequired ? 'Required to apply this change' : 'Not required'} />
      </DescriptionList>
      <Field htmlFor="openai-key" label={status.stored ? 'Replace API key' : 'API key'} hint="Existing key material is never displayed.">
        <TextInput id="openai-key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} />
      </Field>
      {error && <Status tone="danger">{error}</Status>}
      <FormActions>
        {status.stored && <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>Remove stored key</Button>}
        <Button type="submit" variant="primary" busy={busy} disabled={apiKey.trim().length < 20}>Save key</Button>
      </FormActions>
    </FormSection>
  </Form>
}

function AudioSettings () {
  const voice = useCopilotVoice()
  return <Form>
    <FormSection title="Voice audio" description="Audio devices are remembered only by this browser.">
      <FormGrid>
        <Field htmlFor="audio-input" label="Microphone">
          <Select id="audio-input" value={voice.inputId} onChange={event => voice.setInputId(event.target.value)}>
            <option value="">System default</option>
            {voice.devices.inputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Microphone'}</option>)}
          </Select>
        </Field>
        <Field htmlFor="audio-output" label="Output">
          <Select id="audio-output" value={voice.outputId} onChange={event => voice.setOutputId(event.target.value)}>
            <option value="">System default</option>
            {voice.devices.outputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Audio output'}</option>)}
          </Select>
        </Field>
      </FormGrid>
      <Status tone="muted">Browsers may hide device names until microphone access has been granted.</Status>
    </FormSection>
  </Form>
}

function DeviceSettings ({ preferences }: { preferences: DevicePreferences }) {
  const snapshot = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, preferences.getSnapshot)
  return <Form>
    <FormSection title="This browser" description="These choices affect only this browser on this device.">
      <FormGrid>
        <ToggleButton pressed={snapshot.followCopilotNavigation} onClick={() => preferences.update({ followCopilotNavigation: !snapshot.followCopilotNavigation })}>
          Follow Copilot navigation
        </ToggleButton>
        <ToggleButton pressed={snapshot.captureNumpad} onClick={() => preferences.update({ captureNumpad: !snapshot.captureNumpad })}>
          Capture physical numpad
        </ToggleButton>
      </FormGrid>
    </FormSection>
  </Form>
}

function ControlSettings ({ settings, onSave }: {
  settings: InstallationSettings
  onSave(settings: InstallationSettings): Promise<void>
}) {
  const [draft, setDraft] = useState(settings)
  const [busy, setBusy] = useState(false)
  const permission = (key: keyof InstallationSettings['copilotPermissions']) => {
    setDraft(current => ({
      ...current,
      copilotPermissions: { ...current.copilotPermissions, [key]: !current.copilotPermissions[key] }
    }))
  }
  return <Form onSubmit={event => {
    event.preventDefault()
    setBusy(true)
    void onSave(draft).finally(() => setBusy(false))
  }}>
    <FormSection title="Game controls" description="Installation-wide control and Copilot execution permissions.">
      <FormGrid>
        <ToggleButton pressed={draft.controlsEnabled} onClick={() => setDraft(current => ({ ...current, controlsEnabled: !current.controlsEnabled }))}>Game controls</ToggleButton>
        <ToggleButton pressed={draft.copilotPermissions.gameActions} onClick={() => permission('gameActions')}>Copilot game actions</ToggleButton>
        <ToggleButton pressed={draft.copilotPermissions.macros} onClick={() => permission('macros')}>Copilot macros</ToggleButton>
        <ToggleButton tone="warning" pressed={draft.copilotPermissions.dangerousActions} onClick={() => permission('dangerousActions')}>Copilot dangerous actions</ToggleButton>
      </FormGrid>
      <Status tone="muted">Dangerous actions remain separate even when ordinary Copilot actions are allowed.</Status>
      <Status tone="muted">Changing the game-control backend master switch takes effect after the PHOENIX server restarts.</Status>
      <FormActions><Button type="submit" variant="primary" busy={busy}>Save permissions</Button></FormActions>
    </FormSection>
  </Form>
}

function PairingSettings ({ api, pairing }: { api: PhoenixApi, pairing: PairingStatus }) {
  const [busy, setBusy] = useState(false)
  return <Form>
    <FormSection title="Installation pairing" description="PHOENIX currently uses one installation session, not a device registry.">
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Installation" value={pairing.installationId} />
        <DescriptionItem label="This browser" value={pairing.authenticated ? 'Paired' : 'Not paired'} />
        <DescriptionItem label="Pairing required" value={pairing.pairingRequired ? 'Yes' : 'No'} />
      </DescriptionList>
      {pairing.pairingRequired && pairing.authenticated && <FormActions>
        <Button type="button" variant="danger" busy={busy} onClick={() => {
          setBusy(true)
          void api.releasePairing().then(() => globalThis.location?.reload()).finally(() => setBusy(false))
        }}>Forget this browser</Button>
      </FormActions>}
    </FormSection>
  </Form>
}

function title (view: SettingsView): string {
  if (view === 'device') return 'This device'
  return view[0]!.toUpperCase() + view.slice(1)
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update settings.'
}
