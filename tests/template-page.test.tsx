import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PlaceholderPage } from '../apps/web/src/components/shell/placeholder-page.js'
import { InformationWorkspace } from '../apps/web/src/components/shell/information-workspace.js'
import { primaryItems } from '../apps/web/src/components/shell/navigation-model.js'

test('the information workspace composes primary navigation, rail, and page content', () => {
  const markup = renderToStaticMarkup(
    <InformationWorkspace
      contextLabel="Commander views"
      contextItems={[]}
      currentContext=""
      currentPrimary="commander"
      onNavigate={() => undefined}
      primaryItems={primaryItems}
    >
      <PlaceholderPage context="Commander" description="Current page" title="Overview" />
    </InformationWorkspace>
  )

  expect(markup).toContain('class="deskplane-section"')
  expect(markup).toContain('aria-label="Primary"')
  expect(markup).toContain('aria-label="Commander views"')
  expect(markup).toContain('href="#/commander/overview"')
  expect(markup).toContain('href="#/galaxy/system"')
  expect(markup).toContain('class="page-frame page-flow"')
  expect(markup).toContain('<h1>Overview</h1>')
})
