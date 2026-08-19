import { expect, test } from 'vitest'
import { McpSessionRegistry } from '../apps/server/src/infrastructure/phoenix-mcp-server.js'

test('MCP sessions expire after their idle deadline', () => {
  let now = 1_000
  const sessions = new McpSessionRegistry({ idleTimeoutMs: 100, now: () => now })
  sessions.create('session-1')

  now = 1_099
  expect(sessions.touch('session-1')).toBe(true)
  now = 1_199
  expect(sessions.touch('session-1')).toBe(false)
})

test('MCP session capacity evicts the least recently used session', () => {
  let now = 1
  const sessions = new McpSessionRegistry({ maximumSessions: 2, now: () => now })
  sessions.create('oldest')
  now++
  sessions.create('recent')
  now++
  expect(sessions.touch('oldest')).toBe(true)
  now++
  sessions.create('new')

  expect(sessions.touch('recent')).toBe(false)
  expect(sessions.touch('oldest')).toBe(true)
  expect(sessions.touch('new')).toBe(true)
})
