import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Breadcrumbs } from '@phoenix/ui'

test('breadcrumbs use a shared chevron icon between destinations', () => {
  const markup = renderToStaticMarkup(<Breadcrumbs items={[
    { href: '#/galaxy/system', label: 'Galaxy' },
    { label: 'System schematic' }
  ]} />)

  expect(markup).toContain('class="breadcrumb-separator"')
  expect(markup).toContain('d="m9 5 7 7-7 7"')
  expect(markup.match(/breadcrumb-separator/g)).toHaveLength(1)
})
