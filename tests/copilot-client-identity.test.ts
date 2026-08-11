import { expect, test } from 'vitest'
import { createCopilotId } from '../apps/web/src/features/copilot/copilot-client-identity.js'

test('Copilot identifiers do not require secure-context browser crypto', () => {
  expect(createCopilotId(null)).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/u)
  expect(createCopilotId({ randomUUID: () => 'secure-id' })).toBe('secure-id')
})
