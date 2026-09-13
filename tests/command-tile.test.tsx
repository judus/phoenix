import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CommandTile } from '@phoenix/ui'

test('command tiles show compact bindings while retaining the full binding as context', () => {
  const markup = renderToStaticMarkup(
    <CommandTile binding="LeftShift+RightAlt+Numpad_2" label="Test command" />
  )

  expect(markup).toContain('LS+RA+NP_2')
  expect(markup).toContain('title="LeftShift+RightAlt+Numpad_2"')
  expect(markup).toContain('aria-label="Test command, LeftShift+RightAlt+Numpad_2"')
})
