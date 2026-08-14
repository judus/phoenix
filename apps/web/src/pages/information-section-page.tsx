import type {
  ActivityLogEntry,
  CommunicationContact,
  CommunicationMessage,
  CommunicationsResponse,
  GalnetArticle,
  GalnetNewsResponse,
  GameActionCatalogResponse,
  GameActionOperation,
  GameActionResult,
  HealthResponse,
  Mission,
  MissionsResponse
} from '@phoenix/contracts'
import { ActivityLogEntrySchema } from '@phoenix/contracts'
import { useEffect, useState } from 'react'
import type { PhoenixApiClient } from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { GalnetRadioControls } from '../components/galnet-radio-controls.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type OperationsView = 'overview' | 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation'
export type CommsView = 'overview' | 'inbox' | 'traffic' | 'contacts' | 'galnet' | 'radio'

const operationsNavigation: NavigationItem[] = [
  { href: '#/operations/overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#/operations/missions', icon: '▤', id: 'missions', label: 'Missions' },
  { href: '#/operations/objectives', icon: '◎', id: 'objectives', label: 'Objectives' },
  { href: '#/operations/community-goals', icon: '⌁', id: 'community-goals', label: 'Community goals' },
  { href: '#/operations/powerplay', icon: '⬡', id: 'powerplay', label: 'Powerplay' },
  { href: '#/operations/colonisation', icon: '△', id: 'colonisation', label: 'Colonisation' }
]

const commsNavigation: NavigationItem[] = [
  { href: '#/comms/overview', icon: '◇', id: 'overview', label: 'Overview' },
  { href: '#/comms/inbox', icon: '▤', id: 'inbox', label: 'Inbox' },
  { href: '#/comms/traffic', icon: '⌁', id: 'traffic', label: 'Traffic' },
  { href: '#/comms/contacts', icon: '◎', id: 'contacts', label: 'Contacts' },
  { href: '#/comms/galnet', icon: 'N', id: 'galnet', label: 'GalNet' },
  { href: '#/comms/radio', icon: 'RAD', id: 'radio', label: 'Radio' }
]

const operationsViews: Record<OperationsView, { title: string, eyebrow: string, description: string }> = {
  overview: { title: 'Operations', eyebrow: 'Active work', description: 'Missions, objectives, community goals, and current strategic pursuits.' },
  missions: { title: 'Missions', eyebrow: 'Frontier contracts', description: 'Accepted work reconstructed from local journal evidence.' },
  objectives: { title: 'Objectives', eyebrow: 'Commander plans', description: 'PHOENIX-owned goals, reminders, and linked targets.' },
  'community-goals': { title: 'Community Goals', eyebrow: 'Shared operations', description: 'Participation, contribution, tier, reward, and expiry snapshots.' },
  powerplay: { title: 'Powerplay', eyebrow: 'Strategic operations', description: 'Allegiance and activity derived from local events with optional world-state enrichment.' },
  colonisation: { title: 'Colonisation', eyebrow: 'Construction operations', description: 'Depot progress, requested resources, contributions, and payments.' }
}

const commsViews: Record<CommsView, { title: string, eyebrow: string, description: string }> = {
  overview: { title: 'Comms', eyebrow: 'Communications', description: 'Direct messages, local traffic, contacts, GalNet, and the in-game radio remote.' },
  inbox: { title: 'Inbox', eyebrow: 'Direct communications', description: 'Player, friend, wing, team, and squadron messages.' },
  traffic: { title: 'Traffic', eyebrow: 'Local communications', description: 'NPC, station, system, and ambient communications kept separate from the inbox.' },
  contacts: { title: 'Contacts', eyebrow: 'Known commanders', description: 'Best-effort friend, wing, team, and crew presence reconstructed from events.' },
  galnet: { title: 'GalNet', eyebrow: 'Galaxy news', description: 'Cached GalNet articles with offline fallback.' },
  radio: { title: 'GalNet Radio', eyebrow: 'In-game audio remote', description: 'Operate Elite Dangerous GalNet Audio through configured ship commands.' }
}

export function InformationSectionPage ({
  actionCatalog,
  api,
  error,
  health,
  onExecuteAction,
  route
}: {
  actionCatalog?: GameActionCatalogResponse
  api: PhoenixApiClient
  error?: string
  health?: HealthResponse
  onExecuteAction: (actionId: string, operation: GameActionOperation) => Promise<GameActionResult>
  route: { section: 'operations', view: OperationsView } | { section: 'comms', view: CommsView }
}) {
  const operations = route.section === 'operations'
  const definition = operations ? operationsViews[route.view] : commsViews[route.view]
  const navigation = operations ? operationsNavigation : commsNavigation

  return (
    <PhoenixShell
      activePrimaryItemId={route.section}
      activeSecondaryItemId={route.view}
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className={`information-section-page ${route.section}-page`}>
        <PageHeader title={definition.title} eyebrow={definition.eyebrow} description={definition.description} />
        <PageContent>
          {route.section === 'comms' && (route.view === 'inbox' || route.view === 'traffic' || route.view === 'contacts')
            ? <Communications api={api} view={route.view} />
            : route.section === 'comms' && route.view === 'galnet'
            ? <GalnetNews api={api} />
            : route.section === 'operations' && route.view === 'missions'
            ? <Missions api={api} />
            : route.section === 'comms' && route.view === 'radio'
            ? (
                <section className="information-surface information-surface--radio">
                  <GalnetRadioControls actionCatalog={actionCatalog} onExecuteAction={onExecuteAction} />
                  <dl className="information-facts">
                    <dt>Audio source</dt><dd>Elite Dangerous</dd>
                    <dt>Command path</dt><dd>PHOENIX shared action layer</dd>
                    <dt>Playback state</dt><dd>Not exposed by telemetry</dd>
                    <dt>Result authority</dt><dd>Command acceptance only</dd>
                  </dl>
                </section>
              )
            : <SectionScaffold section={route.section} view={route.view} />}
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function Communications ({ api, view }: { api: PhoenixApiClient, view: 'inbox' | 'traffic' | 'contacts' }) {
  const queryView = view === 'contacts' ? 'all' : view
  const [response, setResponse] = useState<CommunicationsResponse>()
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      void api.getCommunications(queryView, 500).then(result => {
        if (!active) return
        setError(undefined)
        setResponse(result)
        const candidates = view === 'contacts' ? result.contacts : result.messages
        setSelectedId(current => current && candidates.some(candidate => candidate.id === current)
          ? current
          : candidates[0]?.id)
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Communications are unavailable.')
      })
    }
    refresh()
    const unsubscribe = subscribePhoenixEvent(api, 'activity-entry', event => {
      try {
        const entry = ActivityLogEntrySchema.parse(JSON.parse(event.data))
        if (entry.source === 'journal' && (entry.event === 'ReceiveText' || entry.event === 'SendText')) refresh()
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Invalid communications update received.')
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api, queryView, view])

  if (error) return <section className="information-surface information-surface--empty"><strong>Communications unavailable</strong><p>{error}</p></section>
  if (!response) return <section className="information-surface information-surface--empty"><strong>Reconstructing communications</strong><p>Reading retained journal messages.</p></section>
  if (view === 'contacts') return <ContactLedger contacts={response.contacts} selectedId={selectedId} onSelect={setSelectedId} />
  return <MessageLedger messages={response.messages} selectedId={selectedId} onSelect={setSelectedId} summary={response.summary} view={view} />
}

function MessageLedger ({ messages, onSelect, selectedId, summary, view }: {
  messages: CommunicationMessage[]
  onSelect: (id: string) => void
  selectedId?: string
  summary: CommunicationsResponse['summary']
  view: 'inbox' | 'traffic'
}) {
  const selected = messages.find(message => message.id === selectedId) ?? messages[0]
  return (
    <section className="communications-ledger">
      <header className="communications-ledger__summary">
        <span>{view}</span><strong>{view === 'inbox' ? summary.inbox : summary.traffic}</strong>
        <span>Inbound</span><strong>{summary.inbound}</strong>
        <span>Outbound</span><strong>{summary.outbound}</strong>
      </header>
      {messages.length === 0
        ? <div className="communications-ledger__empty">No retained {view} messages.</div>
        : (
            <div className="communications-ledger__body">
              <ol className="communications-ledger__index">
                <li className="communications-ledger__columns"><span>Correspondent</span><span>Message</span><span>Received</span></li>
                {messages.map(message => (
                  <li key={message.id}>
                    <button type="button" aria-pressed={message.id === selected?.id} onClick={() => onSelect(message.id)}>
                      <span><strong>{message.sender ?? message.recipient ?? message.senderKind}</strong><small>{message.channel} · {message.direction}</small></span>
                      <span className="communications-ledger__preview">{message.message}</span>
                      <time dateTime={message.timestamp}>{communicationTime(message.timestamp)}</time>
                    </button>
                  </li>
                ))}
              </ol>
              {selected ? <CommunicationDetail message={selected} /> : null}
            </div>
          )}
    </section>
  )
}

function CommunicationDetail ({ message }: { message: CommunicationMessage }) {
  return (
    <article className="communication-detail">
      <header><span>{message.channel} · {message.direction}</span><h2>{message.sender ?? message.recipient ?? message.senderKind}</h2><time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString()}</time></header>
      <p>{message.message}</p>
      <dl>
        <dt>Source</dt><dd>{message.sourceEvent}</dd>
        <dt>Kind</dt><dd>{message.senderKind}</dd>
        <dt>Channel</dt><dd>{message.channel}</dd>
      </dl>
      {message.rawMessage && message.rawMessage !== message.message ? <details><summary>Raw Frontier message</summary><code>{message.rawMessage}</code></details> : null}
    </article>
  )
}

function ContactLedger ({ contacts, onSelect, selectedId }: { contacts: CommunicationContact[], onSelect: (id: string) => void, selectedId?: string }) {
  const selected = contacts.find(contact => contact.id === selectedId) ?? contacts[0]
  return (
    <section className="communications-ledger">
      <header className="communications-ledger__summary"><span>Observed commanders</span><strong>{contacts.length}</strong><small>Last-seen evidence only</small></header>
      {contacts.length === 0
        ? <div className="communications-ledger__empty">No commander correspondents observed yet.</div>
        : (
            <div className="communications-ledger__body">
              <ol className="communications-ledger__index communications-ledger__index--contacts">
                <li className="communications-ledger__columns"><span>Commander</span><span>Channels</span><span>Last seen</span></li>
                {contacts.map(contact => (
                  <li key={contact.id}>
                    <button type="button" aria-pressed={contact.id === selected?.id} onClick={() => onSelect(contact.id)}>
                      <span><strong>{contact.name}</strong><small>{contact.inboundCount} retained messages</small></span>
                      <span>{contact.channels.join(', ')}</span>
                      <time dateTime={contact.lastSeenAt}>{communicationTime(contact.lastSeenAt)}</time>
                    </button>
                  </li>
                ))}
              </ol>
              {selected
                ? <article className="communication-detail"><header><span>Observed contact</span><h2>{selected.name}</h2><time dateTime={selected.lastSeenAt}>{new Date(selected.lastSeenAt).toLocaleString()}</time></header><p>{selected.lastMessage ?? 'No retained message text.'}</p><dl><dt>Channels</dt><dd>{selected.channels.join(', ')}</dd><dt>Inbound</dt><dd>{selected.inboundCount}</dd><dt>Outbound</dt><dd>{selected.outboundCount}</dd><dt>Presence</dt><dd>Unknown</dd></dl></article>
                : null}
            </div>
          )}
    </section>
  )
}

function communicationTime (timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short' }).format(new Date(timestamp))
}

function Missions ({ api }: { api: PhoenixApiClient }) {
  const [response, setResponse] = useState<MissionsResponse>()
  const [selectedId, setSelectedId] = useState<number>()
  const [filter, setFilter] = useState<'active' | 'history' | 'all'>('active')
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    const refresh = (): void => {
      void api.getMissions().then(result => {
        if (!active) return
        setError(undefined)
        setResponse(result)
        setSelectedId(current => current && result.missions.some(mission => mission.id === current)
          ? current
          : result.missions.find(mission => mission.status === 'active')?.id ?? result.missions[0]?.id)
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Mission records are unavailable.')
      })
    }
    refresh()
    const unsubscribe = subscribePhoenixEvent(api, 'activity-entry', event => {
      try {
        const entry = ActivityLogEntrySchema.parse(JSON.parse(event.data))
        if (isMissionActivity(entry)) refresh()
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Invalid mission update received.')
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  if (error) return <section className="information-surface information-surface--empty"><strong>Missions unavailable</strong><p>{error}</p></section>
  if (!response) return <section className="information-surface information-surface--empty"><strong>Reconstructing missions</strong><p>Reading durable journal-backed mission records.</p></section>
  const visible = response.missions.filter(mission => filter === 'all' || (filter === 'active' ? mission.status === 'active' : mission.status !== 'active'))
  const selected = visible.find(mission => mission.id === selectedId) ?? visible[0]

  return (
    <section className="missions-ledger">
      <header className="missions-ledger__summary">
        <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}><span>Active</span><strong>{response.summary.active}</strong></button>
        <button type="button" aria-pressed={filter === 'history'} onClick={() => setFilter('history')}><span>History</span><strong>{response.summary.completed + response.summary.failed + response.summary.abandoned + response.summary.unknown}</strong></button>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><span>All retained</span><strong>{response.summary.total}</strong></button>
        <span className="missions-ledger__partial">{response.summary.partial} incomplete</span>
      </header>
      {visible.length === 0
        ? <div className="missions-ledger__empty">No {filter === 'all' ? '' : `${filter} `}missions retained.</div>
        : (
            <div className="missions-ledger__body">
              <ol className="missions-ledger__index">
                <li className="missions-ledger__columns"><span>Mission</span><span>Destination</span><span>Status</span></li>
                {visible.map(mission => (
                  <li key={mission.id}>
                    <button type="button" aria-pressed={mission.id === selected?.id} onClick={() => setSelectedId(mission.id)}>
                      <span><strong>{missionTitle(mission)}</strong><small>{mission.faction ?? `Mission ${mission.id}`}</small></span>
                      <span>{mission.destinationSystem ?? '—'}<small>{mission.destinationStation ?? mission.destinationSettlement ?? ''}</small></span>
                      <span className={`mission-status mission-status--${mission.status}`}>{mission.status}<small>{mission.provenance.details === 'partial' ? 'Incomplete details' : mission.expiry ?? ''}</small></span>
                    </button>
                  </li>
                ))}
              </ol>
              {selected ? <MissionDetail mission={selected} /> : null}
            </div>
          )}
    </section>
  )
}

const missionJournalEvents = new Set([
  'CargoDepot',
  'MissionAbandoned',
  'MissionAccepted',
  'MissionCompleted',
  'MissionFailed',
  'MissionRedirected',
  'Missions'
])

function isMissionActivity (entry: ActivityLogEntry): boolean {
  return entry.source === 'journal' && missionJournalEvents.has(entry.event)
}

function MissionDetail ({ mission }: { mission: Mission }) {
  const progress = mission.progress.required === null ? null : `${mission.progress.delivered ?? 0} / ${mission.progress.required}`
  return (
    <article className="mission-detail">
      <header><span>Mission {mission.id}</span><h2>{missionTitle(mission)}</h2><strong className={`mission-status mission-status--${mission.status}`}>{mission.status}</strong></header>
      {mission.provenance.details === 'partial' ? <p className="mission-detail__notice">Acceptance detail was not observed. This record is intentionally incomplete.</p> : null}
      <dl>
        <dt>Faction</dt><dd>{mission.faction ?? '—'}</dd>
        <dt>Destination</dt><dd>{[mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ') || '—'}</dd>
        <dt>Target</dt><dd>{[mission.target, mission.targetType, mission.targetFaction].filter(Boolean).join(' / ') || '—'}</dd>
        <dt>Cargo</dt><dd>{mission.commodity ? `${mission.commodity}${mission.commodityCount === null ? '' : ` × ${mission.commodityCount}`}` : '—'}</dd>
        <dt>Delivery progress</dt><dd>{progress ?? '—'}</dd>
        <dt>Required kills</dt><dd>{mission.killCount ?? '—'}</dd>
        <dt>Donation</dt><dd>{mission.donation === null ? '—' : `${mission.donation.toLocaleString()} CR${mission.donated === null ? '' : ` · ${mission.donated.toLocaleString()} donated`}`}</dd>
        <dt>Reward</dt><dd>{mission.reward === null ? '—' : `${mission.reward.toLocaleString()} CR`}</dd>
        <dt>Accepted</dt><dd>{mission.acceptedAt ? new Date(mission.acceptedAt).toLocaleString() : 'Not observed'}</dd>
        <dt>Expiry</dt><dd>{mission.expiry ?? '—'}</dd>
      </dl>
      <footer>{mission.provenance.sources.join(' · ')}</footer>
    </article>
  )
}

function missionTitle (mission: Mission): string {
  return mission.localizedName ?? mission.name?.replace(/^Mission_/u, '').replace(/_name$/u, '').replaceAll('_', ' ') ?? `Mission ${mission.id}`
}

function GalnetNews ({ api }: { api: PhoenixApiClient }) {
  const [news, setNews] = useState<GalnetNewsResponse>()
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    void api.getGalnetNews().then(result => {
      setNews(result)
      setSelectedId(current => current && result.articles.some(article => article.id === current)
        ? current
        : result.articles[0]?.id)
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'GalNet is unavailable.'))
  }, [api])

  if (error) return <section className="information-surface information-surface--empty"><strong>GalNet unavailable</strong><p>{error}</p></section>
  if (!news) return <section className="information-surface information-surface--empty"><strong>Receiving GalNet</strong><p>Synchronising the latest Frontier news feed.</p></section>
  const selected = news.articles.find(article => article.id === selectedId) ?? news.articles[0]
  if (!selected) return <section className="information-surface information-surface--empty"><strong>No broadcasts</strong><p>Frontier returned no GalNet articles.</p></section>

  return (
    <section className="galnet-news">
      <ol className="galnet-news__index">
        {news.articles.map(article => (
          <li key={article.id}>
            <button type="button" aria-pressed={article.id === selected.id} onClick={() => setSelectedId(article.id)}>
              <time dateTime={article.publishedAt}>{galnetDate(article.publishedAt)}</time>
              <strong>{article.title}</strong>
            </button>
          </li>
        ))}
      </ol>
      <GalnetArticleDetail article={selected} cache={news.cache} fetchedAt={news.fetchedAt} />
    </section>
  )
}

function GalnetArticleDetail ({
  article,
  cache,
  fetchedAt
}: {
  article: GalnetArticle
  cache: GalnetNewsResponse['cache']
  fetchedAt: string
}) {
  return (
    <article className="galnet-news__article">
      <header>
        <span>GalNet</span>
        <h2>{article.title}</h2>
        <time dateTime={article.publishedAt}>{galnetDate(article.publishedAt)}</time>
      </header>
      <div className="galnet-news__body">
        {article.body.split(/\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      <footer>{cache} feed · received {new Date(fetchedAt).toLocaleString()}</footer>
    </article>
  )
}

function galnetDate (date: string): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

function SectionScaffold ({ section, view }: { section: 'operations' | 'comms', view: OperationsView | CommsView }) {
  if (view === 'overview') {
    const items = section === 'operations'
      ? operationsNavigation.slice(1)
      : commsNavigation.slice(1)
    return (
      <div className="information-overview-grid">
        {items.map(item => (
          <a className="information-overview-card" href={item.href} key={item.id}>
            <span>{item.icon}</span>
            <strong>{item.label}</strong>
            <small>{overviewDescription(section, item.id)}</small>
          </a>
        ))}
      </div>
    )
  }

  return (
    <section className="information-surface information-surface--empty">
      <strong>No retained data yet</strong>
      <p>The destination is established. Its journal-backed model will be added without inventing missing state or removing the existing Records views.</p>
    </section>
  )
}

function overviewDescription (section: 'operations' | 'comms', id: string): string {
  const descriptions: Record<string, string> = section === 'operations'
    ? {
        missions: 'Accepted Frontier contracts and progress.',
        objectives: 'Commander and Copilot plans.',
        'community-goals': 'Current shared initiatives.',
        powerplay: 'Allegiance and strategic activity.',
        colonisation: 'Construction depot progress.'
      }
    : {
        inbox: 'Direct and group communications.',
        traffic: 'NPC and ambient system chatter.',
        contacts: 'Friend, team, and crew presence.',
        galnet: 'Cached galaxy news.',
        radio: 'Elite GalNet Audio remote.'
      }
  return descriptions[id] ?? 'Destination reserved.'
}
