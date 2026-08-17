import { CommandTile } from '@phoenix/ui'
import type { CopilotVoiceState } from './copilot-voice-provider.js'

export function CopilotVoiceToggle({ voice }: { voice: CopilotVoiceState }) {
  const label = voice.transitioning
    ? voice.connected ? 'Disconnecting voice…' : 'Connecting voice…'
    : voice.connected ? 'Disconnect voice' : 'Connect voice'

  return <CommandTile
    className="copilot-voice-toggle"
    label={voice.connected ? 'Disconnect voice' : 'Connect voice'}
    binding="MIC"
    meta={voice.status}
    selected={voice.connected}
    unavailable={voice.transitioning}
    aria-label={label}
    title={label}
    onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
  />
}
