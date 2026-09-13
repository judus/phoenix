import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Widget } from '../packages/ui/src/components/widget.js'

test('widget keeps its eyebrow separate from its semantic heading', () => {
  const markup = renderToStaticMarkup(
    <Widget eyebrow="Exploration" heading="Pioneer">Content</Widget>
  )

  expect(markup).toMatch(/<span>Exploration<\/span><h3[^>]*>Pioneer<\/h3>/)
  expect(markup).toContain('aria-labelledby=')
})

test('widget can expose an eyebrow without inventing a heading', () => {
  const markup = renderToStaticMarkup(
    <Widget aria-label="Federation reputation" eyebrow="Federation">Content</Widget>
  )

  expect(markup).toContain('<span>Federation</span>')
  expect(markup).not.toContain('<h3')
  expect(markup).toContain('aria-label="Federation reputation"')
})

test('widget does not create an empty body row when it only has a header', () => {
  const markup = renderToStaticMarkup(
    <Widget eyebrow="Commander" heading="Ellan Murdock" />
  )

  expect(markup).not.toContain('widget-body')
})
