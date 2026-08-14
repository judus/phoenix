import type { CopilotVoiceState } from './copilot-voice-provider.js'

export function CopilotVoiceToggle ({
  compact = false,
  iconOnly = false,
  voice
}: {
  compact?: boolean
  iconOnly?: boolean
  voice: CopilotVoiceState
}) {
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
      aria-label={label}
      aria-pressed={voice.connected}
      className={`copilot-voice-toggle${voice.connected ? ' is-connected' : ''}${voice.transitioning ? ' is-transitioning' : ''}`}
      disabled={voice.transitioning}
      title={label}
      type="button"
      onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
    >
      {iconOnly
        ? <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 1 0-7 0v7a3.5 3.5 0 0 0 3.5 3.5Z" />
            <path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7" />
          </svg>
        : label}
    </button>
  )
}
