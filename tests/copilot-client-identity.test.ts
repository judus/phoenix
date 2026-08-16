import { expect, test } from 'vitest'
import { createClientId } from '../apps/web/src/application/identity/client-identity.js'

test('Copilot identifiers do not require secure-context browser crypto', () => {
  expect(createClientId(null)).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/u)
  expect(createClientId({ randomUUID: () => 'secure-id' })).toBe('secure-id')
})
