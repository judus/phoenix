import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
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

test('widget does not reserve scrollbar space before overflow is measured', () => {
  const markup = renderToStaticMarkup(
    <Widget autoHideScrollbar scrollable>Content</Widget>
  )

  expect(markup).toContain('widget scrollable auto-hide-scrollbar')
  expect(markup).not.toContain('has-overflow')
  expect(markup).toContain('data-scroll-state="idle"')
})

test('widget marks a measured overflowing body', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(
      <Widget autoHideScrollbar scrollable>Content</Widget>,
      {
        createNodeMock: element => element.props.className === 'widget-body'
          ? { children: [], clientHeight: 100, scrollHeight: 140 }
          : null
      }
    )
  })

  expect(renderer.root.findByType('article').props.className).toContain('has-overflow')
  await act(async () => renderer.unmount())
})
