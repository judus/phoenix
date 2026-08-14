import { expect, test } from 'vitest'
import { NumpadShortcutCollectionSchema } from '@phoenix/contracts'

test('custom shortcut selectors are unique within their stable branch', () => {
  const target = { type: 'navigation' as const, destinationId: 'information.home' }
  expect(() => NumpadShortcutCollectionSchema.parse([
    { id: 'first', selector: '2', target },
    { id: 'second', selector: '2', target }
  ])).toThrow('assigned twice')
})
