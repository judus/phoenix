import type {
  GalnetArticle,
  GalnetNewsResponse,
  GameActionCatalogResponse,
  GameActionOperation,
  GameActionResult,
  HealthResponse
} from '@phoenix/contracts'
import { useEffect, useState } from 'react'
import type { PhoenixApiClient } from '../api/phoenix-api-client.js'
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
          {route.section === 'comms' && route.view === 'galnet'
            ? <GalnetNews api={api} />
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
