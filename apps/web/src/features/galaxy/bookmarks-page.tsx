import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Breadcrumbs,
  Button,
  ControlContext,
  DataTableGroup,
  Field,
  Form,
  FormActions,
  FormGrid,
  ItemList,
  ItemListItem,
  MultiSelect,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  Textarea,
  TextInput
} from '@phoenix/ui'
import type {
  GalaxyBookmark,
  GalaxyBookmarkTarget,
  GalaxyBookmarkWriteRequest
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { InformationRoute, PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type BookmarksRoute = Extract<InformationRoute, { section: 'galaxy', view: 'bookmarks' }>

export function BookmarksPage ({ api, onNavigate, route }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  route: BookmarksRoute
}) {
  const [bookmarks, setBookmarks] = useState<GalaxyBookmark[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    void api.getGalaxyBookmarks(controller.signal)
      .then(response => setBookmarks(response.bookmarks))
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Bookmarks unavailable.')
      })
    return () => controller.abort()
  }, [api])

  if (!bookmarks) return <BookmarksState error={error} />

  const requestedTarget = targetFromRoute(route)
  const existing = route.bookmarkId
    ? bookmarks.find(bookmark => bookmark.id === route.bookmarkId)
    : requestedTarget
      ? bookmarks.find(bookmark => sameTarget(bookmark.target, requestedTarget))
      : undefined

  if (route.bookmarkId && !existing) {
    return <BookmarksState error="That bookmark no longer exists." />
  }

  if (existing || requestedTarget) {
    return (
      <BookmarkEditor
        bookmark={existing}
        key={existing?.id ?? targetKey(requestedTarget!)}
        onCancel={() => onNavigate(bookmarksRoute)}
        onDelete={async id => {
          await api.deleteGalaxyBookmark(id)
          setBookmarks(current => current?.filter(bookmark => bookmark.id !== id))
          onNavigate(bookmarksRoute)
        }}
        onSave={async input => {
          const saved = await api.saveGalaxyBookmark(input, existing?.id)
          setBookmarks(current => [saved, ...(current ?? []).filter(bookmark => bookmark.id !== saved.id)])
          onNavigate(bookmarksRoute)
        }}
        target={existing?.target ?? requestedTarget!}
      />
    )
  }

  return <BookmarkList bookmarks={bookmarks} onNavigate={onNavigate} />
}

function BookmarkList ({ bookmarks, onNavigate }: {
  bookmarks: GalaxyBookmark[]
  onNavigate(route: PhoenixRoute): void
}) {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const tagOptions = useMemo(() => {
    const tags = new Map<string, string>()
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.tags) tags.set(tag.toLocaleLowerCase(), tag)
    }
    return [...tags].sort((left, right) => left[1].localeCompare(right[1])).map(([value, label]) => ({ label, value }))
  }, [bookmarks])
  const visible = useMemo(() => filterBookmarks(bookmarks, query, selectedTags), [bookmarks, query, selectedTags])

  return (
    <PageFrame>
      <Stack gap="sm">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Bookmarks' }]} />}
          title="Bookmarks"
        />
        <ControlContext context="panel" density="compact">
          <FormGrid>
            <Field htmlFor="bookmark-search" label="Search">
              <TextInput
                id="bookmark-search"
                placeholder="System, body, note, or tag"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </Field>
            <Field htmlFor="bookmark-tags" label="Tags">
              <MultiSelect
                id="bookmark-tags"
                options={tagOptions}
                placeholder="All tags"
                value={selectedTags}
                onChange={setSelectedTags}
              />
            </Field>
          </FormGrid>
        </ControlContext>
        <DataTableGroup meta={`${visible.length} of ${bookmarks.length}`} title="Saved locations">
          {visible.length > 0
            ? (
                <ItemList className="surface" density="compact">
                  {visible.map(bookmark => (
                    <ItemListItem
                      actions={<Button size="sm" variant="outline" onClick={() => onNavigate({ ...bookmarksRoute, bookmarkId: bookmark.id })}>Edit</Button>}
                      description={bookmark.note}
                      eyebrow={bookmark.target.kind === 'body' ? `Body · ${bookmark.target.systemName}` : 'System'}
                      href={targetHref(bookmark.target)}
                      key={bookmark.id}
                      meta={bookmark.tags.length > 0 ? bookmark.tags.join(' · ') : undefined}
                      title={bookmark.target.kind === 'body' ? bookmark.target.bodyName : bookmark.target.systemName}
                    />
                  ))}
                </ItemList>
              )
            : <Status tone="muted">{bookmarks.length === 0 ? 'Bookmark a system or body from the system schematic.' : 'No bookmarks match these filters.'}</Status>}
        </DataTableGroup>
      </Stack>
    </PageFrame>
  )
}

function BookmarkEditor ({ bookmark, onCancel, onDelete, onSave, target }: {
  bookmark?: GalaxyBookmark
  onCancel(): void
  onDelete(id: string): Promise<void>
  onSave(input: GalaxyBookmarkWriteRequest): Promise<void>
  target: GalaxyBookmarkTarget
}) {
  const [note, setNote] = useState(bookmark?.note ?? '')
  const [tags, setTags] = useState(bookmark?.tags.join(', ') ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(undefined)
    try {
      await onSave({ note: note.trim() || null, tags: parseTags(tags), target })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bookmark could not be saved.')
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!bookmark) return
    setSaving(true)
    setError(undefined)
    try {
      await onDelete(bookmark.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bookmark could not be removed.')
      setSaving(false)
    }
  }

  return (
    <PageFrame>
      <Stack gap="sm">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Bookmarks' }]} />}
          title={bookmark ? 'Edit bookmark' : 'Add bookmark'}
        />
        <ControlContext context="panel" density="compact">
          <Form onSubmit={submit}>
            <p><strong>{target.kind === 'body' ? target.bodyName : target.systemName}</strong>{target.kind === 'body' ? ` · ${target.systemName}` : ''}</p>
            <Field htmlFor="bookmark-note" label="Note">
              <Textarea id="bookmark-note" rows={5} value={note} onChange={event => setNote(event.target.value)} />
            </Field>
            <Field htmlFor="bookmark-editor-tags" label="Tags" hint="Separate tags with commas.">
              <TextInput id="bookmark-editor-tags" placeholder="exploration, return later" value={tags} onChange={event => setTags(event.target.value)} />
            </Field>
            <FormActions
              message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}
              navigation={<Button type="button" variant="outline" onClick={onCancel}>Back</Button>}
            >
              {bookmark && <Button disabled={saving} type="button" variant="danger" onClick={() => void remove()}>Remove</Button>}
              <Button busy={saving} type="submit" variant="primary">Save bookmark</Button>
            </FormActions>
          </Form>
        </ControlContext>
      </Stack>
    </PageFrame>
  )
}

function BookmarksState ({ error }: { error?: string }) {
  return (
    <PageFrame aria-busy={!error}>
      <Stack gap="xl">
        <PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Bookmarks' }]} />} title="Bookmarks" />
        <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading bookmarks…'}</Status>
      </Stack>
    </PageFrame>
  )
}

function filterBookmarks (bookmarks: GalaxyBookmark[], query: string, selectedTags: string[]): GalaxyBookmark[] {
  const needle = query.trim().toLocaleLowerCase()
  return bookmarks.filter(bookmark => {
    const tags = bookmark.tags.map(tag => tag.toLocaleLowerCase())
    if (!selectedTags.every(tag => tags.includes(tag))) return false
    if (!needle) return true
    const values = [bookmark.target.systemName, bookmark.note ?? '', ...bookmark.tags]
    if (bookmark.target.kind === 'body') values.push(bookmark.target.bodyName)
    return values.some(value => value.toLocaleLowerCase().includes(needle))
  })
}

function parseTags (input: string): string[] {
  return input.split(',').map(tag => tag.trim()).filter(Boolean)
}

function targetFromRoute (route: BookmarksRoute): GalaxyBookmarkTarget | undefined {
  if (!route.systemName) return undefined
  return route.bodyName
    ? { bodyName: route.bodyName, kind: 'body', systemName: route.systemName }
    : { kind: 'system', systemName: route.systemName }
}

function sameTarget (left: GalaxyBookmarkTarget, right: GalaxyBookmarkTarget): boolean {
  return targetKey(left) === targetKey(right)
}

function targetKey (target: GalaxyBookmarkTarget): string {
  const systemName = target.systemName.trim().toLocaleLowerCase()
  return target.kind === 'system'
    ? `system:${systemName}`
    : `body:${systemName}:${target.bodyName.trim().toLocaleLowerCase()}`
}

function targetHref (target: GalaxyBookmarkTarget): string {
  return phoenixRouteHash({
    kind: 'information',
    section: 'galaxy',
    view: 'system',
    systemName: target.systemName,
    ...(target.kind === 'body' ? { selectedName: target.bodyName } : {})
  })
}

const bookmarksRoute = { kind: 'information', section: 'galaxy', view: 'bookmarks' } as const
