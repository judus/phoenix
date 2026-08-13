import type { CopilotVoiceState } from './copilot-voice-provider.js'

export function CopilotVoiceToggle ({ compact = false, voice }: { compact?: boolean, voice: CopilotVoiceState }) {
  const label = voice.transitioning
    ? voice.connected ? 'Disconnecting…' : 'Connecting…'
    : voice.connected
      ? voice.hostLocation === 'remote'
        ? compact ? 'Disconnect desktop' : 'Disconnect desktop voice'
        : compact ? 'Disconnect' : 'Disconnect voice'
      : voice.hostLocation === 'remote'
        ? compact ? 'Connect desktop' : 'Connect desktop voice'
        : compact ? 'Connect voice' : 'Connect realtime'

  return (
    <button
      aria-pressed={voice.connected}
      className={voice.connected ? 'is-connected' : undefined}
      disabled={voice.transitioning}
      type="button"
      onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
    >
      {label}
    </button>
  )
}
