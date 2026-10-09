import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Breadcrumbs } from '@phoenix/ui'

test('breadcrumbs link ancestors, mark the current page and hide decorative separators from assistive technology', () => {
  const markup = renderToStaticMarkup(<Breadcrumbs items={[
    { href: '#/galaxy/system', label: 'Galaxy' },
    { label: 'System schematic' }
  ]} />)

  expect(markup).toContain('aria-label="Breadcrumb"')
  expect(markup).toContain('<a href="#/galaxy/system">Galaxy</a>')
  expect(markup).toContain('<span aria-current="page">System schematic</span>')
  expect(markup).toContain('<svg aria-hidden="true" class="breadcrumb-separator"')
  expect(markup.match(/breadcrumb-separator/g)).toHaveLength(1)
})
