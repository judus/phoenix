import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ControlDeckDeckSchema } from '@jdu/control-deck-core'
import { ControlDeckSurface } from '@jdu/control-deck-ui'

test('the shared surface renders command spans, spacers, and implicit empty cells', () => {
  const deck = ControlDeckDeckSchema.parse({
    id: 'main',
    name: 'Main',
    context: null,
    layout: { kind: 'grid', columns: 3, rows: 2 },
    elements: [
      {
        id: 'launch',
        kind: 'command',
        target: { adapterId: 'keyboard', commandId: 'launch', configuration: {} },
        placement: { kind: 'grid', column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
        appearance: { label: 'Launch', icon: null, foregroundColor: '#ffffff', backgroundColor: '#112233' }
      },
      {
        id: 'gap',
        kind: 'spacer',
        placement: { kind: 'grid', column: 3, row: 2, columnSpan: 1, rowSpan: 1 }
      }
    ]
  })

  const markup = renderToStaticMarkup(
    <ControlDeckSurface
      aria-label="Main deck"
      deck={deck}
      renderCommand={element => <button>{element.appearance.label}</button>}
      renderEmpty={({ column, row, spacer }) => <span>{spacer ? 'spacer' : `${column}:${row}`}</span>}
    />
  )

  expect(markup).toContain('aria-label="Main deck"')
  expect(markup).toContain('data-element-id="launch"')
  expect(markup).toContain('grid-column:1 / span 2')
  expect(markup).toContain('background-color:#112233')
  expect(markup).toContain('>Launch</button>')
  expect(markup).toContain('>spacer</span>')
  expect(markup).toContain('>1:2</span>')
  expect(markup).not.toContain('>2:1</span>')
})
