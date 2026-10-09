import { expect, test } from 'vitest'
import { createClientId } from '../apps/web/src/application/identity/client-identity.js'

test('Copilot identifiers do not require secure-context browser crypto', () => {
  expect(createClientId(null)).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/u)
  const id = '00000000-0000-4000-8000-000000000001'
  expect(createClientId({ randomUUID: () => id })).toBe(id)
})
