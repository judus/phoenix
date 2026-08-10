import type { HealthResponse, RuntimeState } from '@phoenix/contracts'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type DeveloperView = 'overview' | 'runtime' | 'health' | 'tests' | 'controls'

const developerNavigation: NavigationItem[] = [
  { href: '#/developer/overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#/developer/runtime', icon: '◉', id: 'runtime', label: 'Runtime state' },
  { href: '#/developer/health', icon: '+', id: 'health', label: 'Health' },
  { href: '#/developer/tests', icon: '△', id: 'tests', label: 'Tests' },
  { href: '#/developer/controls', icon: '⌘', id: 'controls', label: 'Controls' }
]

const viewMetadata: Record<DeveloperView, { description: string, title: string }> = {
  overview: {
    title: 'Developer Overview',
    description: 'Internal diagnostics and test surfaces for PHOENIX development.'
  },
  runtime: {
    title: 'Runtime State',
    description: 'The current validated snapshot received by the browser.'
  },
  health: {
    title: 'System Health',
    description: 'Backend, API and persistence health information.'
  },
  tests: {
    title: 'Test Console',
    description: 'High-level scenario triggers will live here.'
  },
  controls: {
    title: 'Control Console',
    description: 'Explicit game-action tests will live here.'
  }
}

export interface DeveloperPageProps {
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  view: DeveloperView
}

export function DeveloperPage ({ error, health, runtimeState, view }: DeveloperPageProps) {
  const metadata = viewMetadata[view]

  return (
    <PhoenixShell
      activeSecondaryItemId={view}
      developerSection
      error={error}
      health={health}
      secondaryNavigation={developerNavigation}
    >
      <Page>
        <PageHeader
          eyebrow="Internal developer tools"
          title={metadata.title}
          description={metadata.description}
        />
        <PageContent>
          {renderDeveloperView(view, health, runtimeState, error)}
        </PageContent>
        <PageFooter>
          <span>Developer section</span>
          <a href="#/">Return to PHOENIX</a>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function renderDeveloperView (
  view: DeveloperView,
  health?: HealthResponse,
  runtimeState?: RuntimeState,
  error?: string
) {
  if (view === 'runtime') {
    return <DeveloperData title="Validated runtime snapshot" value={runtimeState} />
  }

  if (view === 'health') {
    return <DeveloperData title="Health response" value={health ?? (error ? { error } : undefined)} />
  }

  if (view === 'tests' || view === 'controls') {
    return (
      <section className="content-section developer-placeholder">
        <h2 className="section-heading">Extension point ready</h2>
        <p>
          This page intentionally has no active commands yet. Its controls will call explicit
          developer API endpoints instead of bypassing normal PHOENIX application boundaries.
        </p>
      </section>
    )
  }

  return (
    <section className="content-section" aria-labelledby="developer-surfaces-heading">
      <h2 id="developer-surfaces-heading" className="section-heading">Available surfaces</h2>
      <div className="status-list">
        <DeveloperLink href="#/developer/runtime" label="Runtime state" state={runtimeState ? 'Live' : 'Pending'} />
        <DeveloperLink href="#/developer/health" label="System health" state={health ? 'Online' : 'Pending'} />
        <DeveloperLink href="#/developer/tests" label="Test console" state="Ready" />
        <DeveloperLink href="#/developer/controls" label="Control console" state="Ready" />
      </div>
    </section>
  )
}

function DeveloperData ({ title, value }: { title: string, value: unknown }) {
  return (
    <section className="content-section">
      <h2 className="section-heading">{title}</h2>
      <pre className="developer-data">{value ? JSON.stringify(value, null, 2) : 'Waiting for data…'}</pre>
    </section>
  )
}

function DeveloperLink ({ href, label, state }: { href: string, label: string, state: string }) {
  return (
    <a className="status-list__row" href={href}>
      <h3>{label}</h3>
      <p>Open the {label.toLowerCase()} developer surface.</p>
      <span>{state}</span>
    </a>
  )
}
