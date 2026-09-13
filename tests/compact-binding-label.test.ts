import { expect, test } from 'vitest'
import { compactBindingLabel } from '@phoenix/ui'

test('compacts keyboard modifiers and numpad keys without changing their order', () => {
  expect(compactBindingLabel('LeftShift+RightAlt+Numpad_2')).toBe('LS+RA+NP_2')
  expect(compactBindingLabel('LeftControl+RightControl+LeftMeta+RightMeta')).toBe('LC+RC+LM+RM')
})

test('preserves non-modifier binding names', () => {
  expect(compactBindingLabel('Space')).toBe('Space')
  expect(compactBindingLabel('Macro')).toBe('Macro')
})
