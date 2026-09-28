import { useEffect, useState } from 'react'
import type { CommanderLogEntry } from '@phoenix/contracts'
import { Button, Field, FormGrid, ItemList, ItemListItem, PageFrame, PageHeader, Section, Select, Stack, Status, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { formatPhoenixDate, formatPhoenixTime } from '../../components/phoenix-date-time.js'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'

const categories = ['mission', 'trade', 'finance', 'fleet', 'career', 'engineering', 'exploration']

export function CommanderLogPage ({ api, events }: { api: PhoenixApi, events: PhoenixEventHub }) {
  const [entries, setEntries] = useState<CommanderLogEntry[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(50)
  useEffect(() => {
    const abort = new AbortController()
    let revision = 0
    const load = () => {
      const request = ++revision
      void api.getCommanderLog(250, abort.signal).then(result => {
        if (abort.signal.aborted || request !== revision) return
        setEntries(result.entries); setReady(true); setError(undefined)
      }).catch(cause => {
        if (!abort.signal.aborted && request === revision) setError(cause instanceof Error ? cause.message : 'Commander log unavailable.')
      })
    }
    load()
    const unsubscribe = events.subscribe('commander-log-entry', load)
    return () => { abort.abort(); unsubscribe() }
  }, [api, events])
  const filtered = entries.filter(entry => (!category || entry.category === category) && `${entry.title} ${entry.detail ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const days = new Map<string, CommanderLogEntry[]>()
  for (const entry of filtered.slice(0, visible)) {
    const key = formatPhoenixDate(entry.timestamp)
    days.set(key, [...(days.get(key) ?? []), entry])
  }
  return <PageFrame><Stack gap="sm">
    <PageHeader context="Log · Commander" title="Commander log" variant="cockpit" />
    <FormGrid>
      <Field label="Search history" htmlFor="commander-log-search"><TextInput id="commander-log-search" value={query} onChange={event => { setQuery(event.target.value); setVisible(50) }} /></Field>
      <Field label="Category" htmlFor="commander-log-category"><Select id="commander-log-category" value={category} onChange={event => { setCategory(event.target.value); setVisible(50) }}>
        <option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}
      </Select></Field>
    </FormGrid>
    {error && <Status tone="danger" wrap>{error}</Status>}
    {!ready && !error && <Status tone="muted">Loading commander log…</Status>}
    {ready && filtered.length === 0 && <Status tone="muted">No matching log entries.</Status>}
    {[...days].map(([day, rows]) => <Section title={day} key={day}><ItemList>{rows.map(entry => <ItemListItem key={entry.id}
      title={entry.title} description={entry.detail}
      eyebrow={<><time dateTime={entry.timestamp}>{formatPhoenixTime(entry.timestamp)}</time> · {entry.category}</>}
      trailing={entry.creditDelta === null ? null : <span className="currency">{entry.creditDelta >= 0 ? '+' : '−'}{formatPhoenixCredits(Math.abs(entry.creditDelta))}</span>}
    />)}</ItemList></Section>)}
    {filtered.length > visible && <div><Button onClick={() => setVisible(count => count + 50)}>Load more</Button></div>}
    {ready && entries.length === 250 && <Status tone="muted">Showing the latest 250 grouped entries. Filters apply to this recent history.</Status>}
  </Stack></PageFrame>
}
