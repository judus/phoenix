import type { HealthResponse, RuntimeState } from '@phoenix/contracts'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

const secondaryNavigation: NavigationItem[] = [
  { href: '#overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#commander', icon: '♙', id: 'commander', label: 'Commander' },
  { href: '#systems', icon: '◉', id: 'systems', label: 'Systems' },
  { href: '#workshops', icon: '⌁', id: 'workshops', label: 'Workshops' },
  { href: '#blueprints', icon: '⌘', id: 'blueprints', label: 'Blueprints' },
  { href: '#materials', icon: '⬡', id: 'materials', label: 'Materials' }
]

const templateRows = [
  { description: 'Application chrome, navigation and responsive workspace', label: 'App shell', state: 'Ready' },
  { description: 'One semantic main region with header, scrolling content and footer', label: 'Page primitive', state: 'Ready' },
  { description: 'Shared custom properties and layered native CSS', label: 'Design system', state: 'Open' },
  { description: 'Journal ingestion, runtime state and Copilot migration', label: 'Backend integration', state: 'Next' }
]

export interface TemplatePageProps {
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
}

export function TemplatePage ({ error, health, runtimeState }: TemplatePageProps) {
  const runtimeDescription = runtimeState
    ? `Revision ${runtimeState.revision} · ${runtimeState.system.name ?? 'location unknown'}`
    : 'Waiting for the initial runtime snapshot'
  const rows = [
    ...templateRows,
    { description: runtimeDescription, label: 'Runtime state', state: runtimeState ? 'Live' : 'Pending' }
  ]

  return (
    <PhoenixShell
      activePrimaryItemId="engineering"
      activeSecondaryItemId="overview"
      error={error}
      health={health}
      secondaryNavigation={secondaryNavigation}
    >
      <Page>
        <PageHeader
          title="Template Page"
          eyebrow="Shared application layout"
          description="A composed reference page for PHOENIX primitives, patterns and future modules."
        />

        <PageContent>
          <section className="content-section" aria-labelledby="foundation-heading">
            <h2 id="foundation-heading" className="section-heading">Foundation</h2>
            <div className="status-list">
              {rows.map(row => (
                <article key={row.label} className="status-list__row">
                  <h3>{row.label}</h3>
                  <p>{row.description}</p>
                  <span>{row.state}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="composition-heading">
            <h2 id="composition-heading" className="section-heading">Composition</h2>
            <p>
              Replace this content with a module page while retaining the surrounding shell,
              navigation and page primitives.
            </p>
          </section>
        </PageContent>

        <PageFooter>
          <span>PHOENIX template</span>
          <span>{health ? 'Frontend ↔ backend confirmed' : 'Backend link pending'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}
