import { useState, type ReactNode } from 'react'
import { Loading } from '@phoenix/ui'
import type {
  CommunicationContact,
  CommunicationMessage,
  CommunicationsResponse,
  GameActionResult
} from '@phoenix/contracts'
import {
  Breadcrumbs,
  Button,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  ItemList,
  ItemListItem,
  MetricStrip,
  MetricStripItem,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ThirdsGrid,
  Widget
} from '@phoenix/ui'
import { GalnetRadioControls } from '../../components/galnet-radio-controls.js'
import { PhoenixDateTime, UpdatedDateTime } from '../../components/phoenix-date-time.js'
import type { CommsControllerSnapshot, CommsView } from './use-comms-controller.js'
import type { GalnetAnalysisApi } from './galnet-analysis-panel.js'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { GalnetBackgroundPanel } from './galnet-background-panel.js'
import { GalnetArticleReader } from './galnet-article-reader.js'
import { GalnetArchiveBrowser } from './galnet-archive-browser.js'

type GalnetApi = GalnetAnalysisApi & Pick<PhoenixApi, 'getGalnetBackground' | 'saveGalnetBackground' | 'catchUpGalnet' | 'getGalnetCoverage' | 'getGalnetArchive' | 'getGalnetArchivedArticle'>

export function CommsPage({ controller, onExecuteAction, view, analysisApi }: {
  analysisApi: GalnetApi
  controller: CommsControllerSnapshot
  onExecuteAction(actionId: string): Promise<GameActionResult>
  view: CommsView
}) {
  if (controller.status === 'idle' || controller.status === 'loading') return <CommsState title={titleFor(view)} />
  if (view === 'galnet') return <Galnet news={controller.galnet} error={controller.error} api={analysisApi} />
  if (controller.status === 'error') return <CommsState error={controller.error ?? 'Communications unavailable.'} title={titleFor(view)} />
  if (view === 'radio') return <Radio actions={controller.actions} onExecuteAction={onExecuteAction} />
  if (!controller.communications) return <CommsState error="Retained communications unavailable." title={titleFor(view)} />
  if (view === 'contacts') return <Correspondents response={controller.communications} />
  return <Messages response={controller.communications} view={view} />
}

function CommsState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame layout="fit">
      <Stack fill gap="xl">
        <CommsHeader title={title} />
        {error ? <Status tone="danger">{error}</Status> : <Loading>Reading retained communications…</Loading>}
      </Stack>
    </PageFrame>
  )
}

function Messages({ response, view }: { response: CommunicationsResponse, view: 'inbox' | 'traffic' }) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = response.messages.find(message => message.id === selectedId) ?? response.messages[0]
  return (
    <PageFrame className="traffic-page" layout="fit">
      <CommsHeader title={titleFor(view)} />
      <MetricStrip columns={3}>
        <MetricStripItem label="Retained" value={response.summary.total} />
        <MetricStripItem label="Inbound" value={response.summary.inbound} />
        <MetricStripItem label="Outbound" value={response.summary.outbound} />
      </MetricStrip>
      <ThirdsGrid fill gap="lg">
        <div className="span-two">
          <DataTableGroup fill meta={`${response.messages.length} retained`} title={view === 'inbox' ? 'Direct and group messages' : 'Public and local traffic'}>
            {response.messages.length > 0
              ? <MessageTable messages={response.messages} onSelect={setSelectedId} selectedId={selected?.id} />
              : <div><Status tone="muted">No retained {view} messages.</Status></div>}
          </DataTableGroup>
        </div>
        <DataTableGroup contentGap="sm" title="Selected message">
          {selected ? <MessageDetail message={selected} /> : <Status tone="muted">Select a retained message to inspect its details.</Status>}
        </DataTableGroup>
      </ThirdsGrid>
    </PageFrame>
  )
}

function MessageTable({ messages, onSelect, selectedId }: {
  messages: CommunicationMessage[]
  onSelect?(id: string): void
  selectedId?: string
}) {
  return (
    <DataTable className="traffic-table" density="compact" label="Retained communications" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
      <thead><tr><th>Correspondent</th><th>Message</th><th>Recorded</th></tr></thead>
      <tbody>{messages.map(message => (
        <tr
          aria-selected={message.id === selectedId || undefined}
          className={message.id === selectedId ? 'active' : undefined}
          key={message.id}
          onClick={onSelect ? () => onSelect(message.id) : undefined}
          onKeyDown={onSelect ? event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(message.id) }
          } : undefined}
          tabIndex={onSelect ? 0 : undefined}
        >
          <th scope="row"><strong>{correspondent(message)}</strong><small>{message.channel} · {message.direction}</small></th>
          <td title={message.message}>{message.message}</td>
          <td><PhoenixDateTime value={message.timestamp} /></td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function MessageDetail({ message }: { message: CommunicationMessage }) {
  return (
    <article className="traffic-detail">
      <header><small>{message.channel} · {message.direction}</small><h2>{correspondent(message)}</h2><PhoenixDateTime value={message.timestamp} /></header>
      <p>{message.message}</p>
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Source" value={message.sourceEvent} />
        <DescriptionItem label="Kind" value={message.senderKind} />
        <DescriptionItem label="Channel" value={message.channel} />
      </DescriptionList>
      {message.rawMessage && message.rawMessage !== message.message
        ? <details><summary>Raw Frontier message</summary><pre>{message.rawMessage}</pre></details>
        : null}
    </article>
  )
}

function Correspondents({ response }: { response: CommunicationsResponse }) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = response.contacts.find(contact => contact.id === selectedId) ?? response.contacts[0]
  const messageCount = response.contacts.reduce((total, contact) => total + contact.inboundCount + contact.outboundCount, 0)
  const channelCount = new Set(response.contacts.flatMap(contact => contact.channels)).size
  return (
    <PageFrame className="traffic-page" layout="fit">
      <CommsHeader status="Message history, not online presence" title="Correspondents" />
      <MetricStrip columns={3}>
        <MetricStripItem label="Correspondents" value={response.contacts.length} />
        <MetricStripItem label="Messages" value={messageCount} />
        <MetricStripItem label="Channels" value={channelCount} />
      </MetricStrip>
      <ThirdsGrid fill gap="lg">
        <div className="span-two">
          <DataTableGroup fill meta={`${response.contacts.length} observed`} title="Correspondents">
            {response.contacts.length > 0
              ? <ContactTable contacts={response.contacts} onSelect={setSelectedId} selectedId={selected?.id} />
              : <div><Status tone="muted">No commander correspondents observed yet.</Status></div>}
          </DataTableGroup>
        </div>
        <DataTableGroup contentGap="sm" title="Correspondent details">
          {selected ? <CorrespondentDetail contact={selected} /> : <Status tone="muted">Select an observed correspondent to inspect its evidence.</Status>}
        </DataTableGroup>
      </ThirdsGrid>
    </PageFrame>
  )
}

function ContactTable({ contacts, onSelect, selectedId }: { contacts: CommunicationContact[], onSelect(id: string): void, selectedId?: string }) {
  return (
    <DataTable className="traffic-table" density="compact" label="Observed correspondents" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
      <thead><tr><th>Correspondent</th><th>Channels</th><th>Last observed</th></tr></thead>
      <tbody>{contacts.map(contact => (
        <tr
          aria-selected={contact.id === selectedId || undefined}
          className={contact.id === selectedId ? 'active' : undefined}
          key={contact.id}
          onClick={() => onSelect(contact.id)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(contact.id) }
          }}
          tabIndex={0}
        >
          <th scope="row"><strong>{contact.name}</strong><small>{contact.inboundCount + contact.outboundCount} retained messages</small></th>
          <td>{contact.channels.join(', ')}</td>
          <td><PhoenixDateTime value={contact.lastSeenAt} /></td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function CorrespondentDetail({ contact }: { contact: CommunicationContact }) {
  return (
    <article className="traffic-detail">
      <header><small>Observed correspondent</small><h2>{contact.name}</h2><PhoenixDateTime value={contact.lastSeenAt} /></header>
      <p>{contact.lastMessage ?? 'No retained message text.'}</p>
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Channels" value={contact.channels.join(', ')} />
        <DescriptionItem label="Inbound" value={contact.inboundCount} />
        <DescriptionItem label="Outbound" value={contact.outboundCount} />
        <DescriptionItem label="Presence" value="Unknown" />
      </DescriptionList>
    </article>
  )
}

function Galnet({ news, api, error }: { news?: CommsControllerSnapshot['galnet'], api: GalnetApi, error?: string }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [archive, setArchive] = useState(false)
  const [archivedId, setArchivedId] = useState<string>()
  const openArchived = (id: string) => { setArchivedId(id); setArchive(true) }
  const selected = news?.articles.find(article => article.id === selectedId) ?? news?.articles[0]
  return (
    <PageFrame layout="fit">
      <div className="galnet-page">
        <CommsHeader title="GalNet"
          actions={<><Button size="sm" className={`btn-toggle${!archive ? ' active' : ''}`} aria-pressed={!archive} onClick={() => setArchive(false)}>Latest news</Button>
            <Button size="sm" className={`btn-toggle${archive ? ' active' : ''}`} aria-pressed={archive} onClick={() => { setArchivedId(undefined); setArchive(true) }}>Archive</Button></>} />
        {archive ? <GalnetArchiveBrowser api={api} initialArticleId={archivedId} /> : <div className="galnet-layout">
          <DataTableGroup className="galnet-index" meta={news ? `${news.articles.length} articles` : undefined} title="Latest news">
            <div className="galnet-index-scroll" tabIndex={0}>
              {news && <Status tone="muted" wrap>{news.cache} feed · <UpdatedDateTime value={news.fetchedAt} /></Status>}
              <GalnetBackgroundPanel api={api} />
              <ItemList className="surface" density="compact" aria-label="GalNet articles">
                {news?.articles.map(article => (
                  <ItemListItem
                    eyebrow={<PhoenixDateTime precision="date" value={article.publishedAt} />}
                    key={article.id}
                    onClick={() => setSelectedId(article.id)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(article.id) } }}
                    selected={article.id === selected?.id}
                    tabIndex={0}
                    title={article.title}
                  />
                ))}
              </ItemList>
              {error && <Status tone="warning" wrap>{error}</Status>}
              {!news && !error && <Status tone="muted">Reading latest news…</Status>}
            </div>
          </DataTableGroup>
          <DataTableGroup className="galnet-reader-group" meta={selected ? <PhoenixDateTime precision="date" value={selected.publishedAt} /> : undefined} title="GalNet article">
            {selected ? <GalnetArticleReader key={selected.id} article={selected} api={api} onOpen={openArchived} /> : <Status tone="muted">{news ? 'Frontier returned no GalNet articles.' : 'Select Archive to browse retained articles.'}</Status>}
          </DataTableGroup>
        </div>}
      </div>
    </PageFrame>
  )
}

function Radio({ actions, onExecuteAction }: { actions?: CommsControllerSnapshot['actions'], onExecuteAction(actionId: string): Promise<GameActionResult> }) {
  return (
    <PageFrame className="galnet-radio-page" layout="fit">
      <Widget className="galnet-radio-display" heading="GalNet Radio" />
      <GalnetRadioControls actionCatalog={actions} className="galnet-radio-controls" onExecute={onExecuteAction} />
    </PageFrame>
  )
}

function CommsHeader({ status, title, actions }: { status?: ReactNode, title: string, actions?: ReactNode }) {
  const items = title === 'Inbox'
    ? [{ label: 'Comms' }, { label: title }]
    : [{ label: 'Comms', href: '#/comms/inbox' }, { label: title }]
  return <PageHeader variant="cockpit" context={<Breadcrumbs items={items} />} status={status} title={title} actions={actions} />
}

function correspondent(message: CommunicationMessage): string { return message.sender ?? message.recipient ?? message.senderKind }
function titleFor(view: CommsView): string {
  if (view === 'galnet') return 'GalNet'
  if (view === 'radio') return 'GalNet Radio'
  if (view === 'contacts') return 'Correspondents'
  return `${view[0]?.toUpperCase()}${view.slice(1)}`
}
