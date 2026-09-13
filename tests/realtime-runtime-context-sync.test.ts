import { expect, test } from 'vitest'
import {
  RealtimeRuntimeContextSync,
  type RealtimeRuntimeContextEvent
} from '../apps/web/src/features/copilot/realtime-runtime-context-sync.js'

test('Realtime runtime context replaces the previous item and ignores unchanged snapshots', () => {
  const sync = new RealtimeRuntimeContextSync()
  const events: RealtimeRuntimeContextEvent[] = []

  sync.sync({ fingerprint: 'first', text: 'First state.' }, event => events.push(event))
  sync.sync({ fingerprint: 'first', text: 'First state.' }, event => events.push(event))
  sync.sync({ fingerprint: 'second', text: 'Second state.' }, event => events.push(event))

  expect(events).toEqual([
    {
      item: {
        content: [{ text: 'First state.', type: 'input_text' }],
        id: 'phoenix-runtime-context-1',
        role: 'system',
        type: 'message'
      },
      type: 'conversation.item.create'
    },
    { item_id: 'phoenix-runtime-context-1', type: 'conversation.item.delete' },
    {
      item: {
        content: [{ text: 'Second state.', type: 'input_text' }],
        id: 'phoenix-runtime-context-2',
        role: 'system',
        type: 'message'
      },
      type: 'conversation.item.create'
    }
  ])
})

test('Realtime runtime context starts fresh after a disconnect', () => {
  const sync = new RealtimeRuntimeContextSync()
  const events: RealtimeRuntimeContextEvent[] = []
  const context = { fingerprint: 'state', text: 'Current state.' }

  sync.sync(context, event => events.push(event))
  sync.reset()
  sync.sync(context, event => events.push(event))

  expect(events.map(event => event.type)).toEqual([
    'conversation.item.create',
    'conversation.item.create'
  ])
})
