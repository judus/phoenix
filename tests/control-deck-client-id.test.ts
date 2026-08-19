import { expect, test } from 'vitest'
import { createControlDeckClientId } from '@jdu/control-deck-core'

test('hold leases use secure UUIDs when available', () => {
  expect(createControlDeckClientId({ randomUUID: () => 'secure-lease' })).toBe('secure-lease')
})

test('hold leases work in insecure LAN browser contexts without randomUUID', () => {
  expect(createControlDeckClientId(null, () => 123_456, () => 0.25)).toBe('local-2n9c-9')
  expect(createControlDeckClientId({ randomUUID: () => { throw new Error('Secure context required') } }, () => 123_456, () => 0.25)).toBe('local-2n9c-9')
})
