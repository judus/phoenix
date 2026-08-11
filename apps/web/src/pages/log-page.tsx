import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityLogEntrySchema, type ActivityLogEntry, type HealthResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

const navigation: NavigationItem[] = [
  { href: '#log', icon: '▤', id: 'journal', label: 'Journal' }
]

export interface LogPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
}

export function LogPage ({ api, error, health }: LogPageProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [actionableOnly, setActionableOnly] = useState(false)
  const [following, setFollowing] = useState(true)
  const followingRef = useRef(true)
  const [logError, setLogError] = useState<string>()

  useEffect(() => {
    let active = true
    void api.getActivityLog(500).then(result => {
      if (!active) return
      setEntries(result.entries)
      setSelectedId(result.entries[0]?.id)
    }).catch(cause => setLogError(cause instanceof Error ? cause.message : 'Journal unavailable.'))
    const unsubscribe = subscribePhoenixEvent(api, 'activity-entry', event => {
      try {
        const entry = ActivityLogEntrySchema.parse(JSON.parse(event.data))
        setEntries(current => [entry, ...current.filter(item => item.id !== entry.id)].slice(0, 500))
        if (followingRef.current) setSelectedId(entry.id)
      } catch (cause) {
        setLogError(cause instanceof Error ? cause.message : 'Invalid journal event received.')
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const eventTypes = useMemo(() => [...new Set(entries.map(entry => entry.event))].sort(), [entries])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEntries = useMemo(() => entries.filter(entry => {
    if (eventType && entry.event !== eventType) return false
    if (source && entry.source !== source) return false
    if (actionableOnly && !entry.actionable) return false
    return !normalizedQuery || JSON.stringify(entry.data).toLocaleLowerCase().includes(normalizedQuery)
  }), [actionableOnly, entries, eventType, normalizedQuery, source])
  const selected = entries.find(entry => entry.id === selectedId) ?? visibleEntries[0]

  return (
    <PhoenixShell
      activePrimaryItemId="log"
      activeSecondaryItemId="journal"
      error={error ?? logError}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="log-page">
        <PageHeader
          title="Journal"
          eyebrow="Flight recorder"
          description="Live Elite Dangerous events with safe raw-data inspection."
        />
        <PageContent>
          <div className="journal-toolbar">
            <label>
              <span>Search payload</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="System, station, body, commodity…" />
            </label>
            <label>
              <span>Event type</span>
              <select value={eventType} onChange={event => setEventType(event.target.value)}>
                <option value="">All events</option>
                {eventTypes.map(type => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select value={source} onChange={event => setSource(event.target.value)}>
                <option value="">All sources</option>
                <option value="journal">Frontier journal</option>
                <option value="runtime">PHOENIX runtime</option>
                <option value="action">Actions</option>
                <option value="copilot">Copilot</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="journal-toolbar__toggle">
              <input type="checkbox" checked={actionableOnly} onChange={event => setActionableOnly(event.target.checked)} />
              <span>Actionable only</span>
            </label>
            <button type="button" aria-pressed={following} onClick={() => setFollowing(value => {
              followingRef.current = !value
              return !value
            })}>
              {following ? 'Following live' : 'Resume follow'}
            </button>
          </div>
          <div className="journal-workspace">
            <section className="journal-list" aria-label="Journal events">
              {visibleEntries.length === 0 && <p className="journal-empty">No matching journal events.</p>}
              {visibleEntries.map(entry => {
                const summary = summarize(entry)
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="journal-entry"
                    aria-pressed={entry.id === selected?.id}
                    onClick={() => { setSelectedId(entry.id); followingRef.current = false; setFollowing(false) }}
                  >
                    <span className="journal-entry__event">{humanize(entry.event)}</span>
                    {summary && <span className="journal-entry__summary">{summary}</span>}
                    <span className={`journal-entry__importance journal-entry__importance--${entry.importance}`}>{entry.source}</span>
                    <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
                  </button>
                )
              })}
            </section>
            <section className="journal-inspector" aria-label="Selected journal event">
              {selected
                ? <>
                    <header>
                      <div><span>Selected event</span><h2>{humanize(selected.event)}</h2></div>
                      <time dateTime={selected.timestamp}>{new Date(selected.timestamp).toLocaleString()}</time>
                    </header>
                    <pre>{JSON.stringify(selected.data, null, 2)}</pre>
                  </>
                : <p className="journal-empty">Select an event to inspect its payload.</p>}
            </section>
          </div>
        </PageContent>
        <PageFooter>
          <span>{visibleEntries.length} shown · {entries.length} retained in browser</span>
          <span>{following ? 'Live follow active' : 'Selection locked'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function humanize (value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

function formatTime (timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function summarize (entry: ActivityLogEntry): string {
  const keys = ['StarSystem', 'StationName', 'BodyName', 'Body', 'ShipName', 'Name', 'Type']
  const value = keys.map(key => entry.data[key]).find(candidate => typeof candidate === 'string')
  if (typeof value === 'string') return value
  const payload = entry.data.payload
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    const nested = ['name', 'actionId', 'state', 'typeId', 'id']
      .map(key => record[key])
      .find(candidate => typeof candidate === 'string')
    if (typeof nested === 'string') return nested
  }
  return ''
}
