import { expect, test } from 'vitest'
import { NumpadShortcutCollectionSchema } from '@phoenix/contracts'

test('custom shortcut selectors are unique within their stable branch', () => {
  const commandId = 'command.navigation.information.home'
  expect(() => NumpadShortcutCollectionSchema.parse([
    { id: 'first', selector: '2', commandId },
    { id: 'second', selector: '2', commandId }
  ])).toThrow('assigned twice')
})
