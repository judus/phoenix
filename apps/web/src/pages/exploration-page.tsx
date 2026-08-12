import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  ExplorationBodyRecord,
  ExplorationLedgerResponse,
  ExplorationSystemRecord,
  HealthResponse,
  RuntimeState
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type ExplorationView = 'ledger' | 'body' | 'biology' | 'geology'

export interface ExplorationPageProps {
  api: PhoenixApi
  bodyName?: string
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  systemName?: string
  view: ExplorationView
}

export function ExplorationPage ({
  api,
  bodyName,
  error,
  health,
  runtimeState,
  systemName,
  view
}: ExplorationPageProps) {
  const [ledger, setLedger] = useState<ExplorationLedgerResponse>()
  const [explorationError, setExplorationError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      try {
        const result = await api.getExplorationLedger()
        if (active) {
          setLedger(result)
          setExplorationError(undefined)
        }
      } catch (cause) {
        if (active) setExplorationError(errorMessage(cause))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const interval = window.setInterval(() => void load(), 10_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [api, revision])

  const setManualCompletion = async (
    body: ExplorationBodyRecord,
    signal: BiologicalSignalRow,
    completed: boolean
  ): Promise<void> => {
    const prompt = completed
      ? `Mark ${signal.title} as manually completed on ${body.name}?`
      : `Remove manual completion for ${signal.title} on ${body.name}?`
    if (!window.confirm(prompt)) return
    try {
      await api.setExplorationBiologicalCompletion({
        bodyKey: body.key,
        signalKey: signal.key,
        completed
      })
      setExplorationError(undefined)
      setRevision(value => value + 1)
    } catch (cause) {
      setExplorationError(errorMessage(cause))
    }
  }

  const selection = useMemo(
    () => resolveSelection(ledger, runtimeState, systemName, bodyName),
    [bodyName, ledger, runtimeState, systemName]
  )
  const navigation = explorationNavigation(selection.system?.name, selection.body?.name)
  const identity = pageIdentity(view, selection.body)

  return (
    <PhoenixShell
      activePrimaryItemId={undefined}
      activeSecondaryItemId={view}
      error={error ?? explorationError}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="exploration-page">
        <PageHeader title={identity.title} eyebrow={identity.eyebrow} description={identity.description} />
        <PageContent>
          {loading && !ledger
            ? <p className="exploration-empty">Loading exploration records…</p>
            : explorationError && !ledger
              ? <p className="exploration-empty">{explorationError}</p>
              : view === 'ledger'
                ? <ExplorationLedger ledger={ledger} selection={selection} onSetManualCompletion={setManualCompletion} />
                : view === 'body'
                  ? <BodyOverview body={selection.body} runtimeState={runtimeState} />
                  : view === 'biology'
                    ? <BiologyView body={selection.body} onSetManualCompletion={setManualCompletion} />
                    : <GeologyView body={selection.body} />}
        </PageContent>
        <PageFooter>
          <span>Persistent local exploration history</span>
          <span>{ledger ? `${ledger.totals.systems} systems · ${ledger.totals.bodies} bodies` : 'Ledger pending'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function ExplorationLedger ({
  ledger,
  selection,
  onSetManualCompletion
}: {
  ledger?: ExplorationLedgerResponse
  selection: ExplorationSelection
  onSetManualCompletion: ManualCompletionHandler
}) {
  const [explorationState, setExplorationState] = useState<ExplorationStateFilter>('all')
  const [signalState, setSignalState] = useState<SignalStateFilter>('all')
  const systems = useMemo(() => (ledger?.systems ?? []).map(system => ({
    ...system,
    recordedBodyCount: system.bodies.length,
    scannedBodyCount: system.bodies.filter(body => body.scanned).length,
    signalBodyCount: system.bodies.filter(hasSurfaceSignals).length,
    bodies: system.bodies.filter(body => matchesFilters(body, explorationState, signalState))
  })).filter(system => system.bodies.length > 0), [explorationState, ledger, signalState])
  const visibleSystem = systems.find(system => sameName(system.name, selection.system?.name)) ?? systems[0]
  const visibleBody = visibleSystem?.bodies.find(body => sameName(body.name, selection.body?.name))

  if (!ledger || ledger.systems.length === 0) {
    return <p className="exploration-empty">No locally observed bodies have been retained yet.</p>
  }

  return (
    <div className="exploration-ledger">
      <div className="exploration-summary">
        <SummaryMetric label="Systems" value={ledger.totals.systems} />
        <SummaryMetric label="Body records" value={ledger.totals.bodies} />
        <SummaryMetric label="Scanned bodies" value={ledger.totals.scannedBodies} />
        <SummaryMetric label="Mapped by commander" value={ledger.totals.mappedBodies} />
        <SummaryMetric label="Biological signals" value={ledger.totals.biologicalSignals} />
        <SummaryMetric label="Geological signals" value={ledger.totals.geologicalSignals} />
        <SummaryMetric label="Completed samples" value={ledger.totals.samplesCompleted} />
      </div>
      <div className="exploration-filters" aria-label="Exploration filters">
        <label>
          <span>Exploration state</span>
          <select value={explorationState} onChange={event => setExplorationState(event.target.value as ExplorationStateFilter)}>
            <option value="all">All recorded bodies</option>
            <option value="unscanned">Detected, not scanned</option>
            <option value="scanned">Locally scanned</option>
            <option value="mapped">Mapped by commander</option>
          </select>
        </label>
        <label>
          <span>Surface signals</span>
          <select value={signalState} onChange={event => setSignalState(event.target.value as SignalStateFilter)}>
            <option value="all">All bodies</option>
            <option value="signals">Any signal</option>
            <option value="biological">Biological</option>
            <option value="geological">Geological</option>
            <option value="none">No recorded signals</option>
          </select>
        </label>
      </div>
      <div className="exploration-ledger__columns">
        <LedgerColumn title="Systems">
          {systems.length === 0 && <LedgerEmpty>No matching systems</LedgerEmpty>}
          {systems.map(system => (
            <LedgerLink
              active={sameName(system.name, visibleSystem?.name)}
              href={explorationHref('ledger', system.name)}
              key={`${system.address ?? system.name}`}
              meta={systemMeta({ ...system, matchingBodyCount: system.bodies.length })}
              title={system.name}
            />
          ))}
        </LedgerColumn>
        <LedgerColumn title="Bodies">
          {!visibleSystem && <LedgerEmpty>Select a system</LedgerEmpty>}
          {visibleSystem?.bodies.map(body => (
            <LedgerLink
              active={sameName(body.name, visibleBody?.name)}
              href={explorationHref('ledger', visibleSystem.name, body.name)}
              key={body.key}
              meta={bodyMeta(body)}
              title={body.name}
            />
          ))}
        </LedgerColumn>
        <LedgerColumn title="Signals">
          {!visibleBody
            ? <LedgerEmpty>Select a body</LedgerEmpty>
            : <SignalDetail body={visibleBody} onSetManualCompletion={onSetManualCompletion} />}
        </LedgerColumn>
      </div>
      <footer className="exploration-ledger__actions">
        <div><span>Selected body</span><strong>{visibleBody?.name ?? 'None'}</strong></div>
        <div>
          <a className={visibleBody ? undefined : 'is-disabled'} href={visibleBody ? explorationHref('body', visibleBody.systemName, visibleBody.name) : undefined}>Open details</a>
          <a className={visibleSystem ? undefined : 'is-disabled'} href={visibleSystem ? navigationHref(visibleSystem.name, visibleBody?.name) : undefined}>Open navigation</a>
        </div>
      </footer>
    </div>
  )
}

function BodyOverview ({ body, runtimeState }: { body?: ExplorationBodyRecord, runtimeState?: RuntimeState }) {
  if (!body) return <p className="exploration-empty">No planetary body selected.</p>
  const liveBodyName = runtimeState?.location.place?.kind === 'body'
    ? runtimeState.location.place.name
    : runtimeState?.gameStatus?.bodyName
  const isCurrentBody = sameName(body.name, liveBodyName)
  const latitude = isCurrentBody ? runtimeState?.gameStatus?.latitude : null
  const longitude = isCurrentBody ? runtimeState?.gameStatus?.longitude : null
  const completedSamples = biologicalSignalRows(body).filter(signal => signal.completed).length
  return (
    <div className="exploration-sections">
      <section className="exploration-body-hero">
        <div><span>System</span><strong>{body.systemName}</strong></div>
        <div><span>Status</span><strong>{isCurrentBody ? 'Current body' : body.surfaceScanCompleted ? 'Surface mapped' : 'Observed'}</strong></div>
        <a href={navigationHref(body.systemName, body.name)}>Open in navigation</a>
      </section>
      <section className="content-section">
        <h2 className="section-heading">Exploration status</h2>
        <div className="exploration-status-cards">
          <StatusCard label="Previously discovered" value={knownStatus(body.discovered, 'Known', 'Discovery candidate')} />
          <StatusCard label="Surface mapped" value={knownStatus(body.mapped || body.surfaceScanCompleted, 'Mapped', 'Unmapped')} />
          <StatusCard label="First footfall" value={knownStatus(body.footfalled, 'Already claimed', 'Unclaimed')} />
        </div>
        <p className="exploration-evidence-note">
          Discovery, mapping, and footfall reflect the latest retained journal evidence, not a complete lifetime record.
        </p>
      </section>
      <section className="content-section">
        <h2 className="section-heading">Planetary record</h2>
        <dl className="exploration-facts">
          <Fact label="Class" value={body.planetClass} />
          <Fact label="Atmosphere" value={body.atmosphere} />
          <Fact label="Volcanism" value={body.volcanism} />
          <Fact label="Body ID" value={body.bodyId?.toString()} />
          <Fact label="Observed" value={formatDateTime(body.observedAt)} />
          <Fact label="System address" value={body.systemAddress?.toString()} />
          {latitude !== null && latitude !== undefined && <Fact label="Latitude" value={latitude.toFixed(4)} />}
          {longitude !== null && longitude !== undefined && <Fact label="Longitude" value={longitude.toFixed(4)} />}
        </dl>
      </section>
      <section className="content-section">
        <h2 className="section-heading">Signals</h2>
        <div className="exploration-summary exploration-summary--body">
          <SummaryMetric label="Biological" value={body.signals.biological} />
          <SummaryMetric label="Geological" value={body.signals.geological} />
          <SummaryMetric label="Human" value={body.signals.human} />
          <SummaryMetric label="Samples complete" value={completedSamples} />
        </div>
        <dl className="exploration-facts exploration-facts--signals">
          <Fact label="Known genera" value={body.biologicalGenuses.join(', ') || 'None'} />
          <Fact label="Known geological types" value={body.volcanism ?? 'None'} />
        </dl>
      </section>
    </div>
  )
}

function BiologyView ({
  body,
  onSetManualCompletion
}: {
  body?: ExplorationBodyRecord
  onSetManualCompletion: ManualCompletionHandler
}) {
  if (!body) return <p className="exploration-empty">No planetary body selected.</p>
  const rows = biologicalSignalRows(body)
  return (
    <div className="exploration-sections">
      <SelectionHeader body={body} />
      <section className="content-section">
        <h2 className="section-heading">Biological samples</h2>
        {rows.length === 0
          ? <p className="exploration-empty">No biological signals recorded for this body.</p>
          : <table className="data-table exploration-biology-table">
              <thead><tr><th>Genus</th><th>Species</th><th>Variant</th><th>Progress</th><th>Evidence</th><th>Correction</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key} className={row.completed ? 'is-complete' : undefined}>
                    <td><strong>{row.genus}</strong></td><td>{row.species}</td><td>{row.variant}</td>
                    <td><SampleProgress progress={row.progress} /></td>
                    <td>{row.manualCompleted ? 'Commander confirmed' : row.journalCompleted ? 'Journal analysis' : row.updatedAt ? `Journal · ${formatDateTime(row.updatedAt)}` : 'Signal detection only'}</td>
                    <td><CompletionButton body={body} row={row} onSetManualCompletion={onSetManualCompletion} /></td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>
    </div>
  )
}

function GeologyView ({ body }: { body?: ExplorationBodyRecord }) {
  if (!body) return <p className="exploration-empty">No planetary body selected.</p>
  return (
    <div className="exploration-sections">
      <SelectionHeader body={body} />
      <section className="content-section">
        <h2 className="section-heading">Geological signals</h2>
        {body.signals.geological === 0 && !body.volcanism
          ? <p className="exploration-empty">No geological signals recorded for this body.</p>
          : <table className="data-table"><thead><tr><th>Type</th><th>Signals</th><th>Surface status</th></tr></thead><tbody><tr>
              <td><strong>{body.volcanism ?? 'Geological signal'}</strong></td>
              <td>{body.signals.geological}</td>
              <td>{body.surfaceScanCompleted ? 'Mapped' : 'Detected'}</td>
            </tr></tbody></table>}
      </section>
    </div>
  )
}

function SignalDetail ({
  body,
  onSetManualCompletion
}: {
  body: ExplorationBodyRecord
  onSetManualCompletion: ManualCompletionHandler
}) {
  const rows = biologicalSignalRows(body)
  return (
    <div className="exploration-signal-detail">
      {rows.map(row => (
        <div className={row.completed ? 'is-complete' : undefined} key={row.key}>
          <span>{row.title}</span><strong>{row.progress} / 3</strong>
          <small>{[row.variant !== 'Unknown' ? row.variant : undefined, row.manualCompleted ? 'Commander confirmed' : row.journalCompleted ? 'Journal analysis' : 'Journal incomplete'].filter(Boolean).join(' · ')}</small>
          <CompletionButton body={body} row={row} onSetManualCompletion={onSetManualCompletion} />
        </div>
      ))}
      <div><span>Geological</span><strong>{body.signals.geological}</strong><small>{body.volcanism ?? 'Type unknown'}</small></div>
    </div>
  )
}

function CompletionButton ({
  body,
  row,
  onSetManualCompletion
}: {
  body: ExplorationBodyRecord
  row: BiologicalSignalRow
  onSetManualCompletion: ManualCompletionHandler
}) {
  if (row.journalCompleted && !row.manualCompleted) return <span className="exploration-completion-source">Complete</span>
  return (
    <button
      className={row.manualCompleted ? 'exploration-completion-button is-active' : 'exploration-completion-button'}
      onClick={() => void onSetManualCompletion(body, row, !row.manualCompleted)}
      type="button"
    >
      {row.manualCompleted ? 'Remove correction' : 'Mark complete'}
    </button>
  )
}

function SelectionHeader ({ body }: { body: ExplorationBodyRecord }) {
  return <section className="exploration-body-hero"><div><span>Body</span><strong>{body.name}</strong></div><div><span>System</span><strong>{body.systemName}</strong></div><a href={explorationHref('body', body.systemName, body.name)}>Body overview</a></section>
}

function SampleProgress ({ progress }: { progress: number }) {
  return <div className="exploration-sample-progress"><span>{progress} / 3</span><progress value={progress} max={3} /></div>
}

type ManualCompletionHandler = (
  body: ExplorationBodyRecord,
  signal: BiologicalSignalRow,
  completed: boolean
) => Promise<void>

interface BiologicalSignalRow {
  completed: boolean
  genus: string
  journalCompleted: boolean
  key: string
  manualCompleted: boolean
  progress: number
  species: string
  title: string
  updatedAt?: string
  variant: string
}

function biologicalSignalRows (body: ExplorationBodyRecord): BiologicalSignalRow[] {
  const manualKeys = new Set(body.manualBiologicalCompletions.map(completion => completion.signalKey))
  const signals = body.biologicalSignals.length > 0
    ? body.biologicalSignals
    : body.organicSamples.map(sample => ({ key: sample.genus, name: sample.genus }))
  const rows: BiologicalSignalRow[] = signals.map(signal => {
    const sample = body.organicSamples.find(candidate => sameName(candidate.genus, signal.name))
    const manualCompleted = manualKeys.has(signal.key)
    const journalCompleted = sample?.completed === true
    return {
      key: signal.key,
      genus: signal.name,
      species: sample?.species ?? 'Unknown',
      variant: sample?.variant ?? 'Unknown',
      title: sample?.species && sample.species !== 'Unknown' ? sample.species : signal.name,
      ...(sample?.lastUpdated ? { updatedAt: sample.lastUpdated } : {}),
      progress: journalCompleted || manualCompleted ? 3 : sample?.progress ?? 0,
      completed: journalCompleted || manualCompleted,
      journalCompleted,
      manualCompleted
    }
  })
  for (let index = rows.length; index < body.signals.biological; index += 1) {
    const key = `biological-signal-${index}`
    const manualCompleted = manualKeys.has(key)
    rows.push({
      key,
      genus: `Biological signal ${index + 1}`,
      species: 'Unknown',
      variant: 'Unknown',
      title: `Biological signal ${index + 1}`,
      progress: manualCompleted ? 3 : 0,
      completed: manualCompleted,
      journalCompleted: false,
      manualCompleted
    })
  }
  return rows
}

function LedgerColumn ({ children, title }: { children: ReactNode, title: string }) {
  return <section className="exploration-ledger__column"><h2>{title}</h2><div>{children}</div></section>
}

function LedgerLink ({ active, href, meta, title }: { active: boolean, href: string, meta: string, title: string }) {
  return <a className={active ? 'is-active' : undefined} href={href}><strong>{title}</strong><span>{meta}</span></a>
}

function LedgerEmpty ({ children }: { children: ReactNode }) {
  return <p className="exploration-empty">{children}</p>
}

function SummaryMetric ({ label, value }: { label: string, value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function StatusCard ({ label, value }: { label: string, value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function Fact ({ label, value }: { label: string, value?: string | null }) {
  return <><dt>{label}</dt><dd>{value || '—'}</dd></>
}

interface ExplorationSelection {
  system?: ExplorationSystemRecord
  body?: ExplorationBodyRecord
}

function resolveSelection (
  ledger: ExplorationLedgerResponse | undefined,
  runtime: RuntimeState | undefined,
  requestedSystem?: string,
  requestedBody?: string
): ExplorationSelection {
  const systems = ledger?.systems ?? []
  const system = systems.find(candidate => sameName(candidate.name, requestedSystem))
    ?? systems.find(candidate => sameName(candidate.name, runtime?.system.name))
    ?? systems[0]
  const liveBody = runtime?.location.place?.kind === 'body' ? runtime.location.place.name : runtime?.gameStatus?.bodyName
  const body = system?.bodies.find(candidate => sameName(candidate.name, requestedBody))
    ?? system?.bodies.find(candidate => sameName(candidate.name, liveBody))
    ?? system?.bodies.find(candidate => candidate.signals.biological > 0 || candidate.signals.geological > 0)
    ?? system?.bodies[0]
  return { system, body }
}

function explorationNavigation (system?: string, body?: string): NavigationItem[] {
  return [
    { href: '#/records/journal', icon: '▤', id: 'journal', label: 'Journal' },
    { href: explorationHref('ledger', system, body), icon: '⌁', id: 'ledger', label: 'Exploration history' },
    { href: explorationHref('body', system, body), icon: '◉', id: 'body', label: 'Body overview' },
    { href: explorationHref('biology', system, body), icon: '♧', id: 'biology', label: 'Biology' },
    { href: explorationHref('geology', system, body), icon: '△', id: 'geology', label: 'Geology' }
  ]
}

function pageIdentity (view: ExplorationView, body?: ExplorationBodyRecord) {
  if (view === 'body') return { title: body?.name ?? 'Body overview', eyebrow: 'Exploration status', description: body ? `${body.systemName} · discovery, mapping, footfall, and surface signals.` : 'Select an observed body from the exploration ledger.' }
  if (view === 'biology') return { title: body?.name ?? 'Biology', eyebrow: 'Organic sampling', description: 'Known genera and local genetic sampler progress.' }
  if (view === 'geology') return { title: body?.name ?? 'Geology', eyebrow: 'Surface phenomena', description: 'Detected geological signals and volcanism.' }
  return { title: 'Exploration Ledger', eyebrow: 'Persistent signal history', description: 'Locally observed systems, bodies, surface signals, and completed analyses.' }
}

function explorationHref (view: ExplorationView, system?: string, body?: string): string {
  const parameters = new URLSearchParams()
  if (system) parameters.set('system', system)
  if (body) parameters.set('body', body)
  const query = parameters.toString()
  return `#/records/exploration/${view}${query ? `?${query}` : ''}`
}

function navigationHref (system: string, body?: string): string {
  const parameters = new URLSearchParams({ name: system })
  if (body) parameters.set('selected', body)
  return `#/galaxy/system?${parameters.toString()}`
}

type ExplorationStateFilter = 'all' | 'unscanned' | 'scanned' | 'mapped'
type SignalStateFilter = 'all' | 'signals' | 'biological' | 'geological' | 'none'

function matchesFilters (
  body: ExplorationBodyRecord,
  explorationState: ExplorationStateFilter,
  signalState: SignalStateFilter
): boolean {
  const matchesExploration = explorationState === 'all' ||
    (explorationState === 'unscanned' && !body.scanned) ||
    (explorationState === 'scanned' && body.scanned) ||
    (explorationState === 'mapped' && body.surfaceScanCompleted)
  const matchesSignals = signalState === 'all' ||
    (signalState === 'signals' && hasSurfaceSignals(body)) ||
    (signalState === 'biological' && body.signals.biological > 0) ||
    (signalState === 'geological' && body.signals.geological > 0) ||
    (signalState === 'none' && !hasSurfaceSignals(body))
  return matchesExploration && matchesSignals
}

function hasSurfaceSignals (body: ExplorationBodyRecord): boolean {
  return body.signals.biological + body.signals.geological + body.signals.human > 0
}

function bodyMeta (body: ExplorationBodyRecord): string {
  const labels = []
  if (body.surfaceScanCompleted) labels.push('Mapped by commander')
  else if (body.scanned) labels.push(body.mapped ? 'Scanned · previously mapped' : 'Scanned')
  else labels.push('Detected · not scanned')
  if (body.signals.biological > 0) labels.push(`${body.signals.biological} biological`)
  if (body.signals.geological > 0) labels.push(`${body.signals.geological} geological`)
  if (body.signals.human > 0) labels.push(`${body.signals.human} human`)
  if (!hasSurfaceSignals(body)) labels.push('no recorded signals')
  return labels.join(' · ')
}

function systemMeta (system: {
  allBodiesFound: boolean
  matchingBodyCount: number
  recordedBodyCount: number
  reportedBodyCount: number | null
  scannedBodyCount: number
  signalBodyCount: number
}): string {
  const bodyCount = system.reportedBodyCount === null
    ? `${system.recordedBodyCount} body records`
    : `${system.recordedBodyCount}/${system.reportedBodyCount} bodies recorded`
  return [
    system.matchingBodyCount !== system.recordedBodyCount ? `${system.matchingBodyCount} matching` : undefined,
    bodyCount,
    `${system.scannedBodyCount} scanned`,
    `${system.signalBodyCount} with signals`,
    system.allBodiesFound ? 'FSS complete' : 'FSS completion unknown'
  ].filter(Boolean).join(' · ')
}

function knownStatus (value: boolean | null, yes: string, no: string): string {
  return value === null ? 'Unknown' : value ? yes : no
}

function sameName (left?: string | null, right?: string | null): boolean {
  return Boolean(left && right && left.toLocaleLowerCase() === right.toLocaleLowerCase())
}

function formatDateTime (timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp))
}

function errorMessage (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Exploration ledger unavailable.'
}
