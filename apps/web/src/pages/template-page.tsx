import type { HealthResponse } from '@phoenix/contracts'
import { AppHeader, AppShell } from '../components/layout/app-shell.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import {
  PrimaryNavigation,
  SecondaryNavigation,
  type NavigationItem
} from '../components/navigation/navigation.js'
import { AppBrand, TopBar } from '../components/top-bar/top-bar.js'

const primaryNavigation: NavigationItem[] = [
  { href: '#navigation', id: 'navigation', label: 'Navigation' },
  { href: '#ship', id: 'ship', label: 'Ship' },
  { href: '#engineering', id: 'engineering', label: 'Engineering' },
  { href: '#exploration', id: 'exploration', label: 'Exploration' },
  { href: '#controls', id: 'controls', label: 'Controls' },
  { href: '#copilot', id: 'copilot', label: 'Copilot' },
  { href: '#log', id: 'log', label: 'Log' }
]

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
}

export function TemplatePage ({ error, health }: TemplatePageProps) {
  const coreState = health ? 'Core online' : error ? 'Core unavailable' : 'Establishing link…'

  return (
    <AppShell
      header={(
        <AppHeader
          topBar={(
            <TopBar
              brand={<AppBrand name="PHOENIX" qualifier="Terminal" />}
              status={(
                <div className="core-status" aria-live="polite">
                  <span className="core-status__label">{coreState}</span>
                  <span className="core-status__detail">
                    {health ? `${health.database.engine} · API v${health.apiVersion}` : error}
                  </span>
                </div>
              )}
              actions={(
                <div className="top-bar-actions" aria-label="Application actions">
                  <button type="button" aria-label="Messages">▤</button>
                  <button type="button" aria-label="Settings">☷</button>
                  <button type="button" aria-label="Fullscreen">⛶</button>
                </div>
              )}
            />
          )}
          navigation={<PrimaryNavigation activeItemId="engineering" items={primaryNavigation} />}
        />
      )}
      secondaryNavigation={<SecondaryNavigation activeItemId="overview" items={secondaryNavigation} />}
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
              {templateRows.map(row => (
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
    </AppShell>
  )
}

