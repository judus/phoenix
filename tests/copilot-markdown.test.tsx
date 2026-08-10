import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CopilotMarkdown } from '../apps/web/src/features/copilot/copilot-markdown.js'

test('Copilot Markdown supports GFM without rendering raw HTML', () => {
  const markup = renderToStaticMarkup(
    <CopilotMarkdown>{`**Warning**

| System | State |
| --- | --- |
| Sol | Safe |

<script>danger()</script>`}</CopilotMarkdown>
  )

  expect(markup).toContain('<strong>Warning</strong>')
  expect(markup).toContain('<table>')
  expect(markup).toContain('&lt;script&gt;danger()&lt;/script&gt;')
  expect(markup).not.toContain('<script>')
})
