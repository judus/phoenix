import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import type { ConversationMessage } from '@maduser/ai-ts'
import {
  JsonConversationStore,
  conversationFileKey
} from '../apps/server/src/infrastructure/json-conversation-store.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true })))
})

test('JSON conversations survive reloads and remain human-readable', async () => {
  const directory = await temporaryDirectory()
  const store = new JsonConversationStore(directory, {
    clock: () => new Date('2026-08-10T20:00:00.000Z')
  })
  const created = await store.create({ id: 'bridge/log', metadata: { agentId: 'icarus' } })
  await store.append('bridge/log', [message('bridge/log', 'message-1', 'user', 'Report.')], {
    expectedRevision: created.revision
  })
  await store.append('bridge/log', [message('bridge/log', 'message-2', 'assistant', 'Clear.')], {
    expectedRevision: 1
  })

  const file = join(directory, `${conversationFileKey('bridge/log')}.json`)
  const serialized = await readFile(file, 'utf8')
  expect(serialized).toContain('\n  "schemaVersion": 1,')
  expect(serialized).toContain('"id": "bridge/log"')
  expect(serialized.endsWith('\n')).toBe(true)

  const reloaded = new JsonConversationStore(directory)
  await expect(reloaded.snapshot('bridge/log')).resolves.toMatchObject({
    conversation: { id: 'bridge/log', revision: 2 },
    messages: [
      { id: 'message-1', role: 'user' },
      { id: 'message-2', role: 'assistant' }
    ]
  })
  await expect(reloaded.listMessages('bridge/log', {
    afterId: 'message-1',
    limit: 1,
    order: 'descending'
  })).resolves.toMatchObject([{ id: 'message-2' }])
})

test('JSON conversations enforce ownership, uniqueness, cursors, and revisions', async () => {
  const directory = await temporaryDirectory()
  const store = new JsonConversationStore(directory)
  await store.create({ id: 'bridge' })

  await expect(store.create({ id: 'bridge' })).rejects.toMatchObject({
    code: 'conversation_already_exists'
  })
  await expect(store.append('bridge', [message('other', 'wrong-chat', 'user', 'Wrong.')], {
    expectedRevision: 0
  })).rejects.toMatchObject({ code: 'message_conversation_mismatch' })

  const first = message('bridge', 'first', 'user', 'First.')
  await store.append('bridge', [first], { expectedRevision: 0 })
  await expect(store.append('bridge', [first], { expectedRevision: 1 })).rejects.toMatchObject({
    code: 'duplicate_message_id'
  })
  await expect(store.append('bridge', [message('bridge', 'late', 'user', 'Late.')], {
    expectedRevision: 0
  })).rejects.toMatchObject({
    code: 'conversation_revision_conflict',
    retryable: true
  })
  await expect(store.listMessages('bridge', { afterId: 'missing' })).rejects.toMatchObject({
    code: 'message_cursor_not_found'
  })
  await expect(store.listMessages('bridge', { limit: 0 })).rejects.toMatchObject({
    code: 'invalid_message_query_limit'
  })
})

test('simultaneous appends cannot overwrite one another at the same revision', async () => {
  const directory = await temporaryDirectory()
  const store = new JsonConversationStore(directory)
  await store.create({ id: 'concurrent' })

  const results = await Promise.allSettled([
    store.append('concurrent', [message('concurrent', 'one', 'user', 'One.')], {
      expectedRevision: 0
    }),
    store.append('concurrent', [message('concurrent', 'two', 'user', 'Two.')], {
      expectedRevision: 0
    })
  ])

  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  await expect(store.snapshot('concurrent')).resolves.toMatchObject({
    conversation: { revision: 1 },
    messages: [{ role: 'user' }]
  })
})

test('invalid persisted records fail explicitly', async () => {
  const directory = await temporaryDirectory()
  const file = join(directory, `${conversationFileKey('broken')}.json`)
  await writeFile(file, '{"schemaVersion":1,"conversation":{},"messages":[]}\n', 'utf8')

  await expect(new JsonConversationStore(directory).snapshot('broken')).rejects.toMatchObject({
    code: 'conversation_record_invalid'
  })
})

async function temporaryDirectory (): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'phoenix-conversations-'))
  temporaryDirectories.push(directory)
  return directory
}

function message (
  conversationId: string,
  id: string,
  role: 'assistant' | 'user',
  text: string
): ConversationMessage {
  return {
    content: [{ source: role === 'user' ? 'typed' : 'generated', text, type: 'text' }],
    conversationId,
    createdAt: '2026-08-10T20:00:00.000Z',
    id,
    role
  }
}
