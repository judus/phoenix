import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ActionTile, CommandTile } from '@phoenix/ui'

test('action tiles opt into informational styling without changing command tiles or hiding the grip', () => {
  const action = renderToStaticMarkup(<ActionTile label="Find a station" description="Search nearby." status="Facilities" className="compact" />)
  expect(action).toContain('class="tile btn informational compact"')
  expect(action).not.toContain('btn-no-grip')
  expect(action).toContain('Search nearby.')
  expect(renderToStaticMarkup(<CommandTile label="Test command" binding="A" />)).not.toContain('informational')
})

test('command tiles show compact bindings while retaining the full binding as context', () => {
  const markup = renderToStaticMarkup(
    <CommandTile binding="LeftShift+RightAlt+Numpad_2" label="Test command" />
  )

  expect(markup).toContain('LS+RA+NP_2')
  expect(markup).toContain('title="LeftShift+RightAlt+Numpad_2"')
  expect(markup).toContain('aria-label="Test command, LeftShift+RightAlt+Numpad_2"')
})
