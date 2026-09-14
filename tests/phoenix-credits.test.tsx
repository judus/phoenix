import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import {
  formatPhoenixCredits,
  PhoenixCredits
} from '../apps/web/src/components/phoenix-credits.js'
import { CommanderSummaryWidget } from '../apps/web/src/components/commander-summary-widget.js'

test('credits use the PHOENIX number format everywhere', () => {
  expect(formatPhoenixCredits(700_134_351)).toBe("700'134'351 CR")
  expect(formatPhoenixCredits(null)).toBe('—')
  expect(renderToStaticMarkup(<PhoenixCredits value={700_134_351} />)).toBe('<span class="currency">700&#x27;134&#x27;351 CR</span>')
})

test('commander summaries format raw balances through the shared component', () => {
  const markup = renderToStaticMarkup(
    <CommanderSummaryWidget
      credits={700_134_351}
      legalState={null}
      name="Ellan Murdock"
      notoriety={null}
    />
  )

  expect(markup).toContain('class="widget compact commander-summary-widget"')
  expect(markup).toContain('700&#x27;134&#x27;351 CR')
})

test('commander summaries mark negative legal state and notoriety as danger', () => {
  const markup = renderToStaticMarkup(
    <CommanderSummaryWidget
      credits={700_134_351}
      legalState="Wanted"
      name="Ellan Murdock"
      notoriety={{ label: '3', value: 3 }}
    />
  )

  expect(markup).toContain('class="label-action commander-legal-state-negative"')
  expect(markup).toContain('<dd>Wanted</dd>')
  expect(markup).toContain('meter meter-danger meter-compact meter-value-hidden')
})
