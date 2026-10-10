import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Breadcrumbs, Button, ControlContext, Field, Form, FormActions, IconButton, Inline, InputGroup, Masonry, PencilIcon, Widget,
  FormGrid, Loading, PageFrame, PageHeader, Select, Stack, Status, Textarea, TextInput } from '@phoenix/ui'
import { PersonalNoteTargetSchema, type PersonalNote, type PersonalNoteTarget, type PersonalNoteWriteRequest } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { SystemLocationLink } from '../../components/system-location-link.js'
import { MissionTitle } from '../../components/mission-title.js'

type NotesRoute = Extract<PhoenixRoute, { kind: 'notes' }>
const listRoute: NotesRoute = { kind: 'notes' }

export function PersonalNotesPage({ api, onNavigate, route }: {
  api: PhoenixApi, onNavigate(route: PhoenixRoute): void, route: NotesRoute
}) {
  const [notes, setNotes] = useState<PersonalNote[]>()
  const [error, setError] = useState<string>()
  const [query, setQuery] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void api.getPersonalNotes('', controller.signal).then(response => { setNotes(response.notes); setError(undefined) })
      .catch(cause => { if (!controller.signal.aborted) setError(message(cause)) })
    return () => controller.abort()
  }, [api])
  const existing = notes?.find(note => note.id === route.noteId)
  if (notes && (route.newNote || existing)) {
    return <NoteEditor key={existing?.id ?? phoenixRouteHash(route)} note={existing} target={existing?.target ?? route.target ?? null}
      onCancel={() => onNavigate(listRoute)}
      onSave={async input => {
        const saved = await api.savePersonalNote(input, existing?.id)
        setNotes(current => [saved, ...(current ?? []).filter(note => note.id !== saved.id)])
        onNavigate(listRoute)
      }}
      onDelete={existing ? async () => {
        await api.deletePersonalNote(existing.id)
        setNotes(current => current?.filter(note => note.id !== existing.id))
        onNavigate(listRoute)
      } : undefined} />
  }
  const needle = query.trim().toLocaleLowerCase()
  const visible = notes?.filter(note => `${note.title}\n${note.text}\n${note.missionTitle ?? ''}\n${targetLabel(note.target)}`.toLocaleLowerCase().includes(needle)) ?? []
  return <PageFrame><Stack gap="sm">
    <NotesHeader title="Personal notes" actions={<Inline gap="xs" wrap={false}>
      <InputGroup className="note-search filled" htmlFor="note-search" label="Search">
        <TextInput id="note-search" type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </InputGroup>
      <IconButton size="sm" variant="primary" label="New note" onClick={() => onNavigate({ ...listRoute, newNote: true })}>+</IconButton>
    </Inline>} />
    {error ? <Status tone="danger">{error}</Status> : null}
    {route.noteId && notes && !existing ? <Status tone="warning">That note no longer exists. Other notes are still available below.</Status> : null}
    {!notes ? error ? null : <Loading>Loading personal notes…</Loading> : <>
      {visible.length === 0 ? <Status tone="muted">{notes.length ? 'No matching notes.' : 'No personal notes yet.'}</Status>
        : <Masonry aria-label="Personal notes">{visible.map(note => <NoteCard key={note.id} note={note}
          onEdit={() => onNavigate({ ...listRoute, noteId: note.id })} />)}</Masonry>}
    </>}
  </Stack></PageFrame>
}

function NoteCard({ note, onEdit }: { note: PersonalNote, onEdit(): void }) {
  const text = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const element = text.current
    if (!element || expanded) return
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [note.text, expanded])
  return <Widget className="note-card" density="compact" heading={note.title || undefined}>
    <Stack gap="sm">
      {note.text ? <p ref={text} className={`note-text${expanded ? '' : ' collapsed'}`}>{note.text}</p>
        : !note.title ? <Status tone="muted">Empty note</Status> : null}
      {overflowing ? <Button size="sm" variant="quiet" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read more'}</Button> : null}
      <NoteLink note={note} />
      <Inline justify="space-between" gap="xs">
        <small>{note.createdBy === 'copilot' ? 'Copilot' : 'Player'} · <UpdatedDateTime value={note.updatedAt} /></small>
        <IconButton size="sm" variant="outline" label={`Edit ${note.title || 'note'}`} onClick={onEdit}><PencilIcon /></IconButton>
      </Inline>
    </Stack>
  </Widget>
}

function NoteLink({ note }: { note: PersonalNote }) {
  const target = note.target
  if (!target) return null
  if (target.kind === 'mission') return <a href={phoenixRouteHash({ kind: 'information', section: 'activities', view: 'missions', selectedMissionId: target.missionId })}>
    <MissionTitle value={note.missionTitle ?? 'Mission unavailable'} />
  </a>
  return <SystemLocationLink systemName={target.systemName}
    locationName={target.kind === 'station' ? target.stationName : target.kind === 'body' ? target.bodyName : undefined} />
}

function NoteEditor({ note, target, onCancel, onSave, onDelete }: {
  note?: PersonalNote, target: PersonalNoteTarget | null, onCancel(): void,
  onSave(input: PersonalNoteWriteRequest): Promise<void>, onDelete?(): Promise<void>
}) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [text, setText] = useState(note?.text ?? '')
  const [kind, setKind] = useState<PersonalNoteTarget['kind'] | 'general'>(target?.kind ?? 'general')
  const [missionId, setMissionId] = useState(target?.kind === 'mission' ? String(target.missionId) : '')
  const [system, setSystem] = useState(target && target.kind !== 'mission' ? target.systemName : '')
  const [location, setLocation] = useState(target?.kind === 'station' ? target.stationName : target?.kind === 'body' ? target.bodyName : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const candidate = kind === 'general' ? null : kind === 'mission' ? { kind, missionId: missionId.trim() ? Number(missionId) : NaN }
      : kind === 'station' ? { kind, systemName: system, stationName: location }
        : kind === 'body' ? { kind, systemName: system, bodyName: location } : { kind, systemName: system }
    const parsed = PersonalNoteTargetSchema.nullable().safeParse(candidate)
    if (!parsed.success) { setError('Enter the complete linked location or a nonnegative whole mission ID.'); return }
    setBusy(true)
    setError(undefined)
    try { await onSave({ title, text, target: parsed.data }) }
    catch (cause) { setError(message(cause)); setBusy(false) }
  }
  const remove = async () => {
    if (!onDelete || !window.confirm('Delete this note?')) return
    setBusy(true)
    setError(undefined)
    try { await onDelete() } catch (cause) { setError(message(cause)); setBusy(false) }
  }
  return <PageFrame><Stack gap="sm">
    <NotesHeader title={note ? 'Edit note' : 'New note'} />
    <ControlContext context="panel" density="compact"><Form onSubmit={event => { void submit(event) }}>
      <Field label="Title" htmlFor="note-title"><TextInput id="note-title" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <Field label="Note" htmlFor="note-text"><Textarea id="note-text" rows={7} maxLength={16000} value={text} onChange={event => setText(event.target.value)} /></Field>
      <FormGrid>
        <Field label="Link" htmlFor="note-kind"><Select id="note-kind" value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
          <option value="general">General note</option><option value="mission">Mission</option><option value="system">System</option><option value="station">Station</option><option value="body">Body</option>
        </Select></Field>
        {kind === 'mission' ? <Field label="Mission ID" htmlFor="note-mission" required><TextInput id="note-mission" type="number" min={0} step={1} required value={missionId} onChange={event => setMissionId(event.target.value)} /></Field> : null}
        {kind !== 'general' && kind !== 'mission' ? <Field label="System" htmlFor="note-system" required><TextInput id="note-system" required value={system} onChange={event => setSystem(event.target.value)} /></Field> : null}
        {kind === 'station' || kind === 'body' ? <Field label={kind === 'station' ? 'Station' : 'Body'} htmlFor="note-location" required><TextInput id="note-location" required value={location} onChange={event => setLocation(event.target.value)} /></Field> : null}
      </FormGrid>
      <small>{note ? `Created by ${note.createdBy}; last edited by ${note.updatedBy}. ` : ''}Personal context, not verified game facts. Linked notes remain available after the mission ends.</small>
      {note ? <NoteLink note={note} /> : null}
      {error ? <Status tone="danger">{error}</Status> : null}
      <FormActions navigation={<Button type="button" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>}>
        {onDelete ? <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => { void remove() }}>Delete note</Button> : null}
        <Button type="submit" size="sm" variant="primary" busy={busy}>Save note</Button>
      </FormActions>
    </Form></ControlContext>
  </Stack></PageFrame>
}

function NotesHeader({ title, actions }: { title: string, actions?: ReactNode }) {
  return <PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Notes' }]} />} title={title} actions={actions} />
}
function targetLabel(target: PersonalNoteTarget | null): string {
  if (!target) return 'General'
  if (target.kind === 'mission') return `Mission ${target.missionId}`
  return target.kind === 'system' ? target.systemName : `${target.systemName} / ${target.kind === 'station' ? target.stationName : target.bodyName}`
}
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'Personal notes unavailable.' }
