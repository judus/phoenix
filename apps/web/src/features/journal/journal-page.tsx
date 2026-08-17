import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityLogEntry } from '@phoenix/contracts'
import { Breadcrumbs, Button, DataTable, DataTableGroup, Field, PageFrame, PageHeader, Select, Status, TextInput } from '@phoenix/ui'
import type { JournalControllerSnapshot } from './use-journal-controller.js'

const sources: Array<{ label: string, value: ActivityLogEntry['source'] }> = [
  { label: 'Frontier journal', value: 'journal' },
  { label: 'PHOENIX runtime', value: 'runtime' },
  { label: 'Actions', value: 'action' },
  { label: 'Copilot', value: 'copilot' },
  { label: 'System', value: 'system' }
]

const importanceLevels: ActivityLogEntry['importance'][] = ['trace', 'info', 'notable', 'warning', 'critical']

export function JournalPage({ controller }: { controller: JournalControllerSnapshot }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [importance, setImportance] = useState('')
  const [actionableOnly, setActionableOnly] = useState(false)
  const [following, setFollowing] = useState(true)
  const followingRef = useRef(true)

  useEffect(() => {
    if (followingRef.current) setSelectedId(controller.entries[0]?.id)
  }, [controller.entries])

  const eventTypes = useMemo(() => [...new Set(controller.entries.map(entry => entry.event))].sort(), [controller.entries])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEntries = useMemo(() => controller.entries.filter(entry => {
    if (eventType && entry.event !== eventType) return false
    if (source && entry.source !== source) return false
    if (importance && entry.importance !== importance) return false
    if (actionableOnly && !entry.actionable) return false
    return !normalizedQuery || `${entry.event}\n${JSON.stringify(entry.data)}`.toLocaleLowerCase().includes(normalizedQuery)
  }), [actionableOnly, controller.entries, eventType, importance, normalizedQuery, source])
  const selected = visibleEntries.find(entry => entry.id === selectedId) ?? visibleEntries[0]

  return <PageFrame className="journal-page" layout="fit">
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Log' }, { label: 'Journal' }]} />}
      title="Journal"
      status={`${controller.retained} retained`}
    />
    {controller.status === 'error'
      ? <Status tone="danger">{controller.error}</Status>
      : controller.status === 'loading'
        ? <Status tone="muted">Loading journal…</Status>
        : <>
            <div className="journal-toolbar">
              <Field htmlFor="journal-search" label="Search payload"><TextInput id="journal-search" placeholder="System, station, body, commodity…" value={query} onChange={event => setQuery(event.target.value)} /></Field>
              <Field htmlFor="journal-event" label="Event type"><Select id="journal-event" value={eventType} onChange={event => setEventType(event.target.value)}><option value="">All events</option>{eventTypes.map(type => <option key={type} value={type}>{humanize(type)}</option>)}</Select></Field>
              <Field htmlFor="journal-source" label="Source"><Select id="journal-source" value={source} onChange={event => setSource(event.target.value)}><option value="">All sources</option>{sources.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field htmlFor="journal-importance" label="Importance"><Select id="journal-importance" value={importance} onChange={event => setImportance(event.target.value)}><option value="">All levels</option>{importanceLevels.map(level => <option key={level} value={level}>{humanize(level)}</option>)}</Select></Field>
              <label className="journal-actionable"><input type="checkbox" checked={actionableOnly} onChange={event => setActionableOnly(event.target.checked)} /><span>Actionable only</span></label>
              <Button aria-pressed={following} variant={following ? 'primary' : 'outline'} onClick={() => setFollowing(current => { followingRef.current = !current; return !current })}>{following ? 'Following live' : 'Resume follow'}</Button>
            </div>
            <div className="journal-workspace">
              <DataTableGroup className="journal-panel" fill meta={`${visibleEntries.length} retained`} title="Event ledger">
                {visibleEntries.length === 0
                  ? <Status tone="muted">No matching journal events.</Status>
                  : <DataTable className="journal-table" density="compact" label="Journal events" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
                      <thead><tr><th>Event</th><th className="source-column">Source</th><th className="time-column">Observed</th></tr></thead>
                      <tbody>{visibleEntries.map(entry => <tr
                        aria-selected={entry.id === selected?.id || undefined}
                        className={entry.id === selected?.id ? 'active' : undefined}
                        data-importance={entry.importance}
                        key={entry.id}
                        onClick={() => { setSelectedId(entry.id); followingRef.current = false; setFollowing(false) }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedId(entry.id)
                            followingRef.current = false
                            setFollowing(false)
                          }
                        }}
                        tabIndex={0}
                      >
                        <td><strong>{humanize(entry.event)}</strong><small>{summarize(entry)}</small></td>
                        <td>{entry.source}{entry.actionable ? <small>Actionable</small> : null}</td>
                        <td><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></td>
                      </tr>)}</tbody>
                    </DataTable>}
              </DataTableGroup>
              <DataTableGroup className="journal-panel" contentGap="sm" fill title="Event payload">
                <section className="journal-inspector" aria-label="Selected journal event">
                  {selected
                    ? <><header><div><small>{selected.source} · {selected.importance}</small><h2>{humanize(selected.event)}</h2></div><time dateTime={selected.timestamp}>{new Date(selected.timestamp).toLocaleString()}</time></header><pre>{JSON.stringify(selected.data, null, 2)}</pre></>
                    : <Status tone="muted">Select an event to inspect its payload.</Status>}
                </section>
              </DataTableGroup>
            </div>
          </>}
  </PageFrame>
}

function humanize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function summarize(entry: ActivityLogEntry): string {
  const direct = ['StarSystem', 'StationName', 'BodyName', 'Body', 'ShipName', 'Name', 'Type']
    .map(key => entry.data[key])
    .find(candidate => typeof candidate === 'string')
  if (typeof direct === 'string') return direct
  const payload = entry.data.payload
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    const nested = ['name', 'actionId', 'state', 'typeId', 'id'].map(key => record[key]).find(candidate => typeof candidate === 'string')
    if (typeof nested === 'string') return nested
  }
  return '—'
}
