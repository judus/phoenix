import type { HealthResponse } from '@phoenix/contracts'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { useCopilotVoice } from '../features/copilot/copilot-voice-provider.js'

export type SettingsView = 'audio' | 'modules' | 'pairing' | 'system'

const navigation: NavigationItem[] = [
  { href: '#/settings/system', icon: '◇', id: 'system', label: 'System' },
  { href: '#/settings/audio', icon: '◉', id: 'audio', label: 'Audio' },
  { href: '#/settings/modules', icon: '▦', id: 'modules', label: 'Modules' },
  { href: '#/settings/pairing', icon: '⌁', id: 'pairing', label: 'Pairing' }
]

export function SettingsPage ({ health, view }: { health?: HealthResponse, view: SettingsView }) {
  const voice = useCopilotVoice()
  return (
    <PhoenixShell activeSecondaryItemId={view} secondaryNavigation={navigation}>
      <Page className="settings-page">
        <PageHeader
          eyebrow="Configuration"
          title={view === 'audio' ? 'Audio' : view === 'modules' ? 'Modules' : view === 'pairing' ? 'Pairing' : 'System'}
          description={description(view)}
        />
        <PageContent>
          {view === 'audio'
            ? <section className="settings-panel settings-audio">
                <header><span>Realtime voice</span><strong>{voice.status}</strong></header>
                <label>
                  Microphone
                  <select
                    value={voice.inputId}
                    disabled={voice.connected || voice.hostLocation === 'remote'}
                    onChange={event => voice.setInputId(event.target.value)}
                  >
                    <option value="">System default</option>
                    {voice.devices.inputs.map(device => <option key={device.id} value={device.id}>{device.label}</option>)}
                  </select>
                </label>
                <label>
                  Audio output
                  <select
                    value={voice.outputId}
                    disabled={voice.connected || voice.hostLocation === 'remote'}
                    onChange={event => voice.setOutputId(event.target.value)}
                  >
                    <option value="">System default</option>
                    {voice.devices.outputs.map(device => <option key={device.id} value={device.id}>{device.label}</option>)}
                  </select>
                </label>
                <p>{voice.hostLocation === 'remote'
                  ? 'Realtime audio is currently hosted by another browser.'
                  : 'Device selection applies to this browser.'}</p>
              </section>
            : <section className="settings-panel">
                <header><span>{view}</span><strong>{view === 'system' && health ? 'Online' : 'Configuration surface'}</strong></header>
                <p>{placeholder(view)}</p>
              </section>}
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function description (view: SettingsView): string {
  if (view === 'audio') return 'Microphone, output device, and Realtime voice configuration.'
  if (view === 'modules') return 'Enable and configure optional PHOENIX capabilities.'
  if (view === 'pairing') return 'Manage browsers and companion devices connected to this installation.'
  return 'Runtime maintenance, data refresh, cache, and localization settings.'
}

function placeholder (view: Exclude<SettingsView, 'audio'>): string {
  if (view === 'modules') return 'Module controls will move here as their settings contracts are consolidated.'
  if (view === 'pairing') return 'Paired-device management will be exposed here without weakening LAN access controls.'
  return 'Bindings refresh, catalogue rebuild, cache maintenance, and language settings will be added as explicit backend operations.'
}
