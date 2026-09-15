import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Button,
  CommandTile,
  CommandTileGroup,
  ControlContext,
  DashboardColumns,
  DescribedCommandTile,
  DescriptionItem,
  DescriptionList,
  EqualGrid,
  Field,
  Form,
  FormActions,
  NumberInput,
  PageFrame,
  Select,
  Stack,
  Status,
  TextInput,
  Widget
} from '@phoenix/ui'
import type { InstallationSettings, PairingInfo, PairingStatus, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import { PairingAccess } from '../../components/pairing-access.js'

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

export function SettingsPage ({
  api,
  audio,
  devicePreferences
}: {
  api: PhoenixApi
  audio: AudioSettingsController
  devicePreferences: DevicePreferences
}) {
  const [settings, setSettings] = useState<InstallationSettings>()
  const [moduleSettings, setModuleSettings] = useState<PhoenixModules>()
  const [pairing, setPairing] = useState<PairingStatus>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void Promise.all([
      api.getInstallationSettings(abort.signal),
      api.getModuleSettings(abort.signal),
      api.getPairingStatus(abort.signal)
    ])
      .then(([nextSettings, nextModuleSettings, nextPairing]) => {
        setSettings(nextSettings)
        setModuleSettings(nextModuleSettings)
        setPairing(nextPairing)
      })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  if (error) return <PageFrame><Status tone="danger">{error}</Status></PageFrame>
  if (!settings || !moduleSettings || !pairing) return <PageFrame><Status tone="muted">Loading settings…</Status></PageFrame>

  const updateSettings = async (next: InstallationSettings): Promise<void> => {
    const saved = await api.saveInstallationSettings({
      controlsEnabled: next.controlsEnabled,
      copilotPermissions: next.copilotPermissions
    })
    setSettings(saved)
  }

  return (
    <PageFrame className="settings-page" layout="fit">
      <DashboardColumns
        gap="xs"
        primary={<>
          <CopilotSettings api={api} settings={settings} onChange={setSettings} />
          <CurrentShipSettings api={api} settings={moduleSettings} onChange={setModuleSettings} />
          <EqualGrid columns={2} gap="xs">
            <DeviceSettings preferences={devicePreferences} />
            <ControlSettings settings={settings} onSave={updateSettings} />
          </EqualGrid>
        </>}
        secondary={<>
          <AudioSettings audio={audio} />
          <PairingSettings api={api} pairing={pairing} />
        </>}
      />
    </PageFrame>
  )
}

function CurrentShipSettings({ api, settings, onChange }: {
  api: PhoenixApi
  settings: PhoenixModules
  onChange(settings: PhoenixModules): void
}) {
  const [threshold, setThreshold] = useState(settings.currentShip.moduleHealthAlertThreshold)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const saved = await api.saveModuleSettings({
        ...settings,
        currentShip: { moduleHealthAlertThreshold: threshold }
      })
      onChange(saved)
    } catch (cause) {
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  return <Widget heading="Current ship">
    <ControlContext density="compact">
      <Form id="current-ship-settings-form" onSubmit={event => { event.preventDefault(); void save() }}>
        <Field htmlFor="module-health-alert-threshold" label="Module health alert threshold">
          <NumberInput
            id="module-health-alert-threshold"
            max={99}
            min={1}
            step={1}
            value={threshold}
            onChange={event => setThreshold(Math.max(1, Math.min(99, Number(event.target.value))))}
          />
        </Field>
        <Status tone="muted" wrap>Show modules whose reported health is at or below this percentage.</Status>
        {error && <Status tone="danger">{error}</Status>}
        <FormActions>
          <Button busy={busy} disabled={threshold === settings.currentShip.moduleHealthAlertThreshold} type="submit" variant="primary">
            Save threshold
          </Button>
        </FormActions>
      </Form>
    </ControlContext>
  </Widget>
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

  return <div className="widget-command-row">
    <Widget heading="Copilot · OpenAI" meta={status.restartRequired ? 'Restart required' : status.configured ? `Configured · ${status.source}` : 'Not configured'}>
      <ControlContext density="compact">
        <Form id="openai-settings-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <Field htmlFor="openai-key" label={status.stored ? 'Replace API key' : 'API key'}>
            <TextInput id="openai-key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} />
          </Field>
          {status.restartRequired && <Status tone="warning" wrap>OpenAI configuration changed. Restart PHOENIX to apply it.</Status>}
          {error && <Status tone="danger">{error}</Status>}
        </Form>
      </ControlContext>
    </Widget>
    <CommandTile
      binding={busy ? 'Working' : 'Store'}
      form="openai-settings-form"
      label={status.stored ? 'Replace key' : 'Save key'}
      unavailable={busy || apiKey.trim().length < 20}
    />
    {status.stored && <CommandTile
      binding="Stored"
      label="Remove key"
      tone="danger"
      unavailable={busy}
      onClick={event => { event.preventDefault(); void remove() }}
    />}
  </div>
}

function AudioSettings ({ audio }: { audio: AudioSettingsController }) {
  return <Widget heading="Voice audio" meta="This device">
    <ControlContext density="compact">
      <Stack gap="sm">
        <Field htmlFor="audio-input" label="Microphone">
          <Select id="audio-input" value={audio.inputId} onChange={event => audio.setInputId(event.target.value)}>
            <option value="">System default</option>
            {audio.devices.inputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Microphone'}</option>)}
          </Select>
        </Field>
        <Field htmlFor="audio-output" label="Output">
          <Select id="audio-output" value={audio.outputId} onChange={event => audio.setOutputId(event.target.value)}>
            <option value="">System default</option>
            {audio.devices.outputs.map(device => <option key={device.id} value={device.id}>{device.label || 'Audio output'}</option>)}
          </Select>
        </Field>
        <Status tone="muted" wrap>Device names may remain hidden until microphone access is granted.</Status>
      </Stack>
    </ControlContext>
  </Widget>
}

function DeviceSettings ({ preferences }: { preferences: DevicePreferences }) {
  const snapshot = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, preferences.getSnapshot)
  return <CommandTileGroup title="This device" meta="Browser local">
    <DescribedCommandTile description="Open pages on this screen when Copilot navigates through PHOENIX.">
      <CommandTile
        binding={snapshot.followCopilotNavigation ? 'On' : 'Off'}
        label="Follow Copilot"
        selected={snapshot.followCopilotNavigation}
        onClick={() => preferences.update({ followCopilotNavigation: !snapshot.followCopilotNavigation })}
      />
    </DescribedCommandTile>
    <DescribedCommandTile description="Reserve this keyboard's physical numpad for PHOENIX shortcuts.">
      <CommandTile
        binding={snapshot.captureNumpad ? 'On' : 'Off'}
        label="Capture numpad"
        selected={snapshot.captureNumpad}
        onClick={() => preferences.update({ captureNumpad: !snapshot.captureNumpad })}
      />
    </DescribedCommandTile>
    <DescribedCommandTile description="Scale Numpy labels according to their length and available button space.">
      <CommandTile
        binding={snapshot.variableNumpadFontSizes ? 'On' : 'Off'}
        label="Variable font sizes"
        selected={snapshot.variableNumpadFontSizes}
        onClick={() => preferences.update({ variableNumpadFontSizes: !snapshot.variableNumpadFontSizes })}
      />
    </DescribedCommandTile>
  </CommandTileGroup>
}

function ControlSettings ({ settings, onSave }: {
  settings: InstallationSettings
  onSave(settings: InstallationSettings): Promise<void>
}) {
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const change = async (id: string, next: InstallationSettings): Promise<void> => {
    setPending(id)
    setError(undefined)
    try {
      await onSave(next)
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }
  const permission = (key: keyof InstallationSettings['copilotPermissions']) => void change(key, {
    ...settings,
    copilotPermissions: { ...settings.copilotPermissions, [key]: !settings.copilotPermissions[key] }
  })

  return <CommandTileGroup title="Control permissions" meta={pending ? 'Updating' : 'Installation'}>
      <DescribedCommandTile description="Allow PHOENIX to send configured inputs to Elite. Requires a restart.">
        <CommandTile
          binding={settings.controlsEnabled ? 'On' : 'Off'}
          label="Game controls"
          selected={settings.controlsEnabled}
          unavailable={pending !== undefined}
          onClick={() => void change('controls', { ...settings, controlsEnabled: !settings.controlsEnabled })}
        />
      </DescribedCommandTile>
      <DescribedCommandTile description="Allow Copilot to execute individual game actions.">
        <CommandTile
          binding={settings.copilotPermissions.gameActions ? 'On' : 'Off'}
          label="Copilot actions"
          selected={settings.copilotPermissions.gameActions}
          unavailable={pending !== undefined}
          onClick={() => permission('gameActions')}
        />
      </DescribedCommandTile>
      <DescribedCommandTile description="Allow Copilot to run recorded command sequences.">
        <CommandTile
          binding={settings.copilotPermissions.macros ? 'On' : 'Off'}
          label="Copilot macros"
          selected={settings.copilotPermissions.macros}
          unavailable={pending !== undefined}
          onClick={() => permission('macros')}
        />
      </DescribedCommandTile>
      <DescribedCommandTile description="Allow Copilot to execute commands marked as dangerous.">
        <CommandTile
          binding={settings.copilotPermissions.dangerousActions ? 'On' : 'Off'}
          label="Dangerous actions"
          selected={settings.copilotPermissions.dangerousActions}
          tone="danger"
          unavailable={pending !== undefined}
          onClick={() => permission('dangerousActions')}
        />
      </DescribedCommandTile>
      {error && <Status className="span-full" tone="danger">{error}</Status>}
  </CommandTileGroup>
}

function PairingSettings ({ api, pairing }: { api: PhoenixApi, pairing: PairingStatus }) {
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<PairingInfo>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!pairing.serverDevice) return
    const abort = new AbortController()
    void api.getPairingInfo(abort.signal)
      .then(setInfo)
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api, pairing.serverDevice])
  return <div className="pairing-settings">
    {info && <PairingAccess info={info} />}
    {error && <Status tone="danger">{error}</Status>}
    {!info && <Widget heading="Device pairing" meta={pairing.authenticated ? 'Paired' : 'Not paired'}>
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Installation" value={pairing.installationId} />
        <DescriptionItem label="This browser" value={pairing.authenticated ? 'Paired' : 'Not paired'} />
        <DescriptionItem label="Required" value={pairing.pairingRequired ? 'Yes' : 'No'} />
      </DescriptionList>
    </Widget>}
    {pairing.pairingRequired && pairing.authenticated && <CommandTile
      binding={busy ? 'Working' : 'Paired'}
      label="Unpair device"
      tone="danger"
      unavailable={busy}
      onClick={() => {
        setBusy(true)
        void api.releasePairing().then(() => globalThis.location?.reload()).finally(() => setBusy(false))
      }}
    />}
  </div>
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update settings.'
}
