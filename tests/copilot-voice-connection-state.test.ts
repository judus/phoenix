import { expect, test } from 'vitest'
import { CopilotVoiceConnectionState } from '../apps/web/src/features/copilot/copilot-voice-connection-state.js'

test('local voice intent ignores stale coordinator commands but accepts the next command', () => {
  const state = new CopilotVoiceConnectionState()
  state.noteLocalIntent(4)

  expect(state.acceptCommand({ revision: 4 })).toBe(false)
  expect(state.acceptCommand({ revision: 5 })).toBe(false)
  state.confirmLocalIntent({ revision: 5 })
  expect(state.acceptCommand({ revision: 6 })).toBe(true)
  expect(state.appliedRevision).toBe(6)
})

test('cancelled voice connection attempts cannot complete later', () => {
  const state = new CopilotVoiceConnectionState()
  const attempt = state.beginConnection()
  state.cancelConnection()

  expect(state.isCurrentConnection(attempt)).toBe(false)
})
