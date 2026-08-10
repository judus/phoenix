import type {
  GameActionCatalogResponse,
  GameActionResult,
  EliteStatusSourceDiagnostics,
  HealthResponse,
  RuntimeState
} from '@phoenix/contracts'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type DeveloperView = 'overview' | 'runtime' | 'elite' | 'health' | 'tests' | 'controls'

const developerNavigation: NavigationItem[] = [
  { href: '#/developer/overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#/developer/runtime', icon: '◉', id: 'runtime', label: 'Runtime state' },
  { href: '#/developer/elite', icon: '≋', id: 'elite', label: 'Elite status' },
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
  elite: {
    title: 'Elite Status',
    description: 'Status.json discovery, ingestion diagnostics and normalized live telemetry.'
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
    description: 'Exercise the action catalogue through the configured input backend.'
  }
}

export interface DeveloperPageProps {
  actionCatalog?: GameActionCatalogResponse
  actionPending?: string
  eliteStatusDiagnostics?: EliteStatusSourceDiagnostics
  error?: string
  health?: HealthResponse
  lastActionResult?: GameActionResult
  onExecuteAction?: (actionId: string) => void
  runtimeState?: RuntimeState
  view: DeveloperView
}

export function DeveloperPage ({
  actionCatalog,
  actionPending,
  error,
  eliteStatusDiagnostics,
  health,
  lastActionResult,
  onExecuteAction,
  runtimeState,
  view
}: DeveloperPageProps) {
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
          {renderDeveloperView({
            actionCatalog,
            actionPending,
            eliteStatusDiagnostics,
            error,
            health,
            lastActionResult,
            onExecuteAction,
            runtimeState,
            view
          })}
        </PageContent>
        <PageFooter>
          <span>Developer section</span>
          <a href="#/">Return to PHOENIX</a>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function renderDeveloperView (props: DeveloperPageProps) {
  const { error, health, runtimeState, view } = props
  if (view === 'runtime') {
    return <DeveloperData title="Validated runtime snapshot" value={runtimeState} />
  }

  if (view === 'health') {
    return <DeveloperData title="Health response" value={health ?? (error ? { error } : undefined)} />
  }

  if (view === 'elite') {
    return (
      <>
        <DeveloperData title="Status source diagnostics" value={props.eliteStatusDiagnostics} />
        <DeveloperData title="Normalized game status" value={runtimeState?.gameStatus} />
      </>
    )
  }

  if (view === 'controls') return <DeveloperControls {...props} />

  if (view === 'tests') {
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
        <DeveloperLink
          href="#/developer/elite"
          label="Elite status"
          state={props.eliteStatusDiagnostics?.fileAvailable ? 'Live' : 'Unavailable'}
        />
        <DeveloperLink href="#/developer/health" label="System health" state={health ? 'Online' : 'Pending'} />
        <DeveloperLink href="#/developer/tests" label="Test console" state="Ready" />
        <DeveloperLink href="#/developer/controls" label="Control console" state="Ready" />
      </div>
    </section>
  )
}

function DeveloperControls ({
  actionCatalog,
  actionPending,
  lastActionResult,
  onExecuteAction
}: DeveloperPageProps) {
  if (!actionCatalog) return <p>Waiting for the action catalogue…</p>

  return (
    <>
      <section className="content-section">
        <h2 className="section-heading">Input backend</h2>
        <p className="developer-backend-status">
          <strong>{actionCatalog.backend.id}</strong>
          <span>{actionCatalog.backend.detail}</span>
          <span>{actionCatalog.backend.simulated ? 'Simulation' : 'Live input'}</span>
        </p>
      </section>

      <section className="content-section">
        <h2 className="section-heading">Action catalogue</h2>
        <div className="developer-action-grid">
          {actionCatalog.actions.map(action => (
            <article className="developer-action" key={action.definition.id}>
              <div>
                <h3>{action.definition.label}</h3>
                <p>{action.definition.description}</p>
              </div>
              <dl>
                <dt>Action</dt><dd>{action.definition.id}</dd>
                <dt>Elite</dt><dd>{action.definition.eliteBinding}</dd>
                <dt>Binding</dt><dd>{action.binding?.display ?? 'Unbound'}</dd>
              </dl>
              <button
                type="button"
                disabled={!action.available || actionPending !== undefined}
                onClick={() => onExecuteAction?.(action.definition.id)}
              >
                {actionPending === action.definition.id ? 'Executing…' : 'Test action'}
              </button>
            </article>
          ))}
        </div>
      </section>

      {lastActionResult && (
        <section className="content-section">
          <h2 className="section-heading">Last result</h2>
          <pre className="developer-data">{JSON.stringify(lastActionResult, null, 2)}</pre>
        </section>
      )}
    </>
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
