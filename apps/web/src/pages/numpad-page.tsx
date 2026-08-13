import type { HealthResponse } from '@phoenix/contracts'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

const navigation: NavigationItem[] = [
  { href: '#/numpad', icon: '123', id: 'navigator', label: 'Command navigator' }
]

export interface NumpadPageProps {
  error?: string
  health?: HealthResponse
}

export function NumpadPage ({ error, health }: NumpadPageProps) {
  return (
    <PhoenixShell
      activeSecondaryItemId="navigator"
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="numpad-page">
        <PageHeader
          title="Numpad"
          eyebrow="Command navigator"
          description="Dedicated numerical access to PHOENIX destinations, controls, and macros."
        />
        <PageContent>
          <section className="content-section" aria-labelledby="numpad-foundation-heading">
            <h2 id="numpad-foundation-heading" className="section-heading">Command map pending</h2>
            <p>
              This surface is reserved for the device-local command navigator. Its semantic tree,
              resolver, and interchangeable presentation will be connected after catalogue
              propagation has been verified.
            </p>
          </section>
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}
