import { useState } from 'react'
import type {
  CommunicationContact,
  CommunicationMessage,
  CommunicationsResponse,
  GalnetArticle,
  GameActionResult
} from '@phoenix/contracts'
import {
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  ItemList,
  ItemListItem,
  Metric,
  MetricStrip,
  MetricStripItem,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ThirdsGrid,
  Widget
} from '@phoenix/ui'
import { GalnetRadioControls } from './galnet-radio-controls.js'
import type { CommsControllerSnapshot, CommsView } from './use-comms-controller.js'

export function CommsPage({ controller, onExecuteAction, view }: {
  controller: CommsControllerSnapshot
  onExecuteAction(actionId: string): Promise<GameActionResult>
  view: CommsView
}) {
  if (controller.status === 'idle' || controller.status === 'loading') return <CommsState title={titleFor(view)} />
  if (controller.status === 'error') return <CommsState error={controller.error ?? 'Communications unavailable.'} title={titleFor(view)} />
  if (view === 'galnet') return controller.galnet ? <Galnet news={controller.galnet} /> : <CommsState error="GalNet unavailable." title="GalNet" />
  if (view === 'radio') return <Radio actions={controller.actions} onExecuteAction={onExecuteAction} />
  if (!controller.communications) return <CommsState error="Retained communications unavailable." title={titleFor(view)} />
  if (view === 'overview') return <Overview response={controller.communications} />
  if (view === 'contacts') return <Contacts response={controller.communications} />
  return <Messages response={controller.communications} view={view} />
}

function CommsState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame aria-busy={!error}>
      <Stack gap="xl">
        <CommsHeader title={title} />
        <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Reading retained communications…'}</Status>
      </Stack>
    </PageFrame>
  )
}

function Overview({ response }: { response: CommunicationsResponse }) {
  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <CommsHeader title="Comms" />
        <MetricStrip columns={5}>
          <MetricStripItem label="Retained" value={response.summary.total} />
          <MetricStripItem label="Inbox" value={response.summary.inbox} />
          <MetricStripItem label="Traffic" value={response.summary.traffic} />
          <MetricStripItem label="Inbound" value={response.summary.inbound} />
          <MetricStripItem label="Outbound" value={response.summary.outbound} />
        </MetricStrip>
        <DataTableGroup fill meta={`${response.messages.length} retained`} title="Recent communications">
          {response.messages.length > 0 ? <MessageTable messages={response.messages} /> : <div><Status tone="muted">No communications retained.</Status></div>}
        </DataTableGroup>
      </Stack>
    </PageFrame>
  )
}

function Messages({ response, view }: { response: CommunicationsResponse, view: 'inbox' | 'traffic' }) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = response.messages.find(message => message.id === selectedId) ?? response.messages[0]
  const count = view === 'inbox' ? response.summary.inbox : response.summary.traffic
  return (
    <PageFrame className="traffic-page" layout="fit">
      <CommsHeader title={titleFor(view)} />
      <MetricStrip columns={3}>
        <MetricStripItem label={titleFor(view)} value={count} />
        <MetricStripItem label="Inbound" value={response.summary.inbound} />
        <MetricStripItem label="Outbound" value={response.summary.outbound} />
      </MetricStrip>
      <ThirdsGrid fill gap="lg">
        <div className="span-two">
          <DataTableGroup fill meta={`${response.messages.length} retained`} title={view === 'inbox' ? 'Direct communications' : 'Local traffic'}>
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
      <thead><tr><th>Correspondent</th><th>Message</th><th>Received</th></tr></thead>
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
          <td><time dateTime={message.timestamp}>{shortDateTime(message.timestamp)}</time></td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function MessageDetail({ message }: { message: CommunicationMessage }) {
  return (
    <article className="traffic-detail">
      <header><small>{message.channel} · {message.direction}</small><h2>{correspondent(message)}</h2><time dateTime={message.timestamp}>{longDateTime(message.timestamp)}</time></header>
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

function Contacts({ response }: { response: CommunicationsResponse }) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = response.contacts.find(contact => contact.id === selectedId) ?? response.contacts[0]
  return (
    <PageFrame className="traffic-page" layout="fit">
      <CommsHeader title="Contacts" />
      <MetricStrip columns={3}>
        <MetricStripItem detail="Last-seen evidence only" label="Observed commanders" value={response.contacts.length} />
        <MetricStripItem label="Inbound" value={response.summary.inbound} />
        <MetricStripItem label="Outbound" value={response.summary.outbound} />
      </MetricStrip>
      <ThirdsGrid fill gap="lg">
        <div className="span-two">
          <DataTableGroup fill meta={`${response.contacts.length} observed`} title="Correspondents">
            {response.contacts.length > 0
              ? <ContactTable contacts={response.contacts} onSelect={setSelectedId} selectedId={selected?.id} />
              : <div><Status tone="muted">No commander correspondents observed yet.</Status></div>}
          </DataTableGroup>
        </div>
        <DataTableGroup contentGap="sm" title="Contact details">
          {selected ? <ContactDetail contact={selected} /> : <Status tone="muted">Select an observed contact to inspect its evidence.</Status>}
        </DataTableGroup>
      </ThirdsGrid>
    </PageFrame>
  )
}

function ContactTable({ contacts, onSelect, selectedId }: { contacts: CommunicationContact[], onSelect(id: string): void, selectedId?: string }) {
  return (
    <DataTable density="compact" label="Observed contacts" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
      <thead><tr><th>Commander</th><th>Channels</th><th>Last observed</th></tr></thead>
      <tbody>{contacts.map(contact => (
        <tr className={contact.id === selectedId ? 'active' : undefined} key={contact.id} onClick={() => onSelect(contact.id)} tabIndex={0}>
          <th scope="row"><strong>{contact.name}</strong><small>{contact.inboundCount + contact.outboundCount} retained messages</small></th>
          <td>{contact.channels.join(', ')}</td>
          <td><time dateTime={contact.lastSeenAt}>{shortDateTime(contact.lastSeenAt)}</time></td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function ContactDetail({ contact }: { contact: CommunicationContact }) {
  return (
    <Stack gap="lg">
      <Metric label="Observed contact" value={contact.name} />
      <p>{contact.lastMessage ?? 'No retained message text.'}</p>
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Channels" value={contact.channels.join(', ')} />
        <DescriptionItem label="Inbound" value={contact.inboundCount} />
        <DescriptionItem label="Outbound" value={contact.outboundCount} />
        <DescriptionItem label="Last observed" value={longDateTime(contact.lastSeenAt)} />
        <DescriptionItem label="Presence" value="Unknown" />
      </DescriptionList>
    </Stack>
  )
}

function Galnet({ news }: { news: NonNullable<CommsControllerSnapshot['galnet']> }) {
  const [selectedId, setSelectedId] = useState<string>()
  const selected = news.articles.find(article => article.id === selectedId) ?? news.articles[0]
  return (
    <PageFrame layout="fit">
      <div className="galnet-page">
        <CommsHeader status={`${news.cache} feed · received ${longDateTime(news.fetchedAt)}`} title="GalNet" />
        <div className="galnet-layout">
          <DataTableGroup className="galnet-index" meta={`${news.articles.length} articles`} title="Latest news">
            <div className="galnet-index-scroll" tabIndex={0}>
              <ItemList density="compact" aria-label="GalNet articles">
                {news.articles.map(article => (
                  <ItemListItem
                    eyebrow={<time className="text-information" dateTime={article.publishedAt}>{shortDate(article.publishedAt)}</time>}
                    key={article.id}
                    onClick={() => setSelectedId(article.id)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(article.id) } }}
                    selected={article.id === selected?.id}
                    tabIndex={0}
                    title={article.title}
                  />
                ))}
              </ItemList>
            </div>
          </DataTableGroup>
          <DataTableGroup className="galnet-reader-group" meta={selected ? shortDate(selected.publishedAt) : undefined} title="GalNet article">
            {selected ? <GalnetArticleDetail article={selected} /> : <Status tone="muted">Frontier returned no GalNet articles.</Status>}
          </DataTableGroup>
        </div>
      </div>
    </PageFrame>
  )
}

function GalnetArticleDetail({ article }: { article: GalnetArticle }) {
  return (
    <article className="galnet-reader">
      <header><small>GalNet</small><h2>{article.title}</h2></header>
      <div className="article-body" tabIndex={0}>{article.body.split(/\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </article>
  )
}

function Radio({ actions, onExecuteAction }: { actions?: CommsControllerSnapshot['actions'], onExecuteAction(actionId: string): Promise<GameActionResult> }) {
  return (
    <PageFrame className="galnet-radio-page" layout="fit">
      <Widget className="galnet-radio-display" title="GalNet Radio" />
      <GalnetRadioControls actionCatalog={actions} className="galnet-radio-controls" onExecute={onExecuteAction} />
    </PageFrame>
  )
}

function CommsHeader({ status, title }: { status?: string, title: string }) {
  const items = title === 'Comms'
    ? [{ label: 'Comms' }]
    : [{ label: 'Comms', href: '#/comms/overview' }, { label: title }]
  return <PageHeader variant="cockpit" context={<Breadcrumbs items={items} />} status={status} title={title} />
}

function correspondent(message: CommunicationMessage): string { return message.sender ?? message.recipient ?? message.senderKind }
function shortDate(value: string): string { return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
function shortDateTime(value: string): string { return new Intl.DateTimeFormat(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short' }).format(new Date(value)) }
function longDateTime(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function titleFor(view: CommsView): string { return view === 'galnet' ? 'GalNet' : view === 'radio' ? 'GalNet Radio' : `${view[0]?.toUpperCase()}${view.slice(1)}` }
