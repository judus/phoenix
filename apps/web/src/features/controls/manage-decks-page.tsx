import { useEffect, useState } from 'react'
import { createControlDeckGroup, removeControlDeck, replaceControlDeckGroup } from 'control-deck/core'
import { PhoenixControlDeckConfigurationSchema, type PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import { ArrowDownIcon, ArrowUpIcon, Breadcrumbs, Button, ControlContext, DataTable, DataTableGroup, IconButton, Inline, Loading, OpenIcon, PageFrame, PageHeader, PencilIcon, Status, TextInput, TrashIcon } from '@phoenix/ui'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'

export function ManageDecksPage({ controller, onSave, onOpen, onEdit }: {
  controller: ControlsControllerSnapshot
  onSave(configuration: PhoenixControlDeckConfiguration): Promise<PhoenixControlDeckConfiguration>
  onOpen(deckId: string): void
  onEdit(deckId: string): void
}) {
  const [draft, setDraft] = useState(controller.configuration)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState<string>()
  // A completed save keeps its returned snapshot until the controller observes the save event.
  useEffect(() => { if (!dirty) setDraft(controller.configuration) }, [controller.configuration])
  const change = (configuration: PhoenixControlDeckConfiguration) => {
    setDraft(configuration); setDirty(true); setError(undefined); setDeleting(undefined)
  }
  const apply = (operation: () => PhoenixControlDeckConfiguration) => {
    try { change(operation()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update decks.') }
  }
  const create = () => {
    if (!draft) return
    apply(() => {
      const created = createControlDeckGroup(draft)
      return PhoenixControlDeckConfigurationSchema.parse(replaceControlDeckGroup(created.configuration,
        { ...created.group, name: 'New deck', appearance: undefined }))
    })
  }
  const save = async () => {
    if (!draft) return
    const parsed = PhoenixControlDeckConfigurationSchema.safeParse({ ...draft,
      groups: draft.groups?.map(group => ({ ...group, name: group.name.trim() })),
      decks: draft.decks.map(deck => ({ ...deck, name: deck.name.trim() })) })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Invalid deck configuration.'); return }
    setSaving(true)
    try { setDraft(await onSave(parsed.data)); setDirty(false); setError(undefined) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save decks.') }
    finally { setSaving(false) }
  }
  return <PageFrame layout="fit" className="manage-decks-page">
    <PageHeader context={<Breadcrumbs items={[{ label: 'Controls' }, { label: 'Manage decks' }]} />}
      title="Manage decks" variant="cockpit" actions={<Button size="sm" variant="outline" disabled={!draft || saving || draft.decks.length >= 256} onClick={create}>New deck</Button>} />
    {error && <Status tone="danger">{error}</Status>}
    {controller.status === 'error' && <Status tone="danger">{controller.error}</Status>}
    {!draft ? <Loading>Loading decks…</Loading> : <>
      <DataTableGroup fill title="Control decks">
        <DataTable label="Control decks" density="compact" narrow="priority" scheme="surface" stickyHeader>
          <thead><tr><th className="col-fill">Name</th><th className="col-fit">Layout</th><th className="col-fit">Actions</th></tr></thead>
          <tbody>{draft.decks.map((deck, index) => {
            const group = draft.groups?.find(group => group.id === deck.groupId)
            const name = group?.name ?? deck.name
            return <tr key={deck.id}>
              <td className="col-fill"><TextInput className="form-mini" aria-label={`Deck name ${index + 1}`} value={name}
                maxLength={80} disabled={saving} onChange={event => change(group ? { ...draft,
                  groups: draft.groups!.map(candidate => candidate.id === group.id ? { ...candidate, name: event.target.value } : candidate) }
                  : { ...draft, decks: draft.decks.map(candidate => candidate.id === deck.id ? { ...candidate, name: event.target.value } : candidate) })} /></td>
              <td className="col-fit">{deck.layout.columns} × {deck.layout.rows}</td>
              <td className="col-fit"><ControlContext density="compact"><Inline gap="xxs" wrap={false}>
                <IconButton size="sm" variant="outline" label={`Open ${name}`} disabled={dirty || saving} onClick={() => onOpen(deck.id)}><OpenIcon /></IconButton>
                <IconButton size="sm" variant="outline" label={`Edit ${name}`} disabled={dirty || saving} onClick={() => onEdit(deck.id)}><PencilIcon /></IconButton>
                <IconButton size="sm" variant="outline" label={`Move ${name} up`} disabled={saving || index === 0} onClick={() => change(reorderDeck(draft, index, index - 1))}><ArrowUpIcon /></IconButton>
                <IconButton size="sm" variant="outline" label={`Move ${name} down`} disabled={saving || index === draft.decks.length - 1} onClick={() => change(reorderDeck(draft, index, index + 1))}><ArrowDownIcon /></IconButton>
                <IconButton size="sm" variant="danger" label={`Delete ${name}`} disabled={saving || draft.decks.length === 1} onClick={() => setDeleting(deck.id)}><TrashIcon /></IconButton>
              </Inline></ControlContext>
              {deleting === deck.id && <ControlContext density="compact"><Inline gap="xs">
                <span>Delete this deck and its buttons?</span>
                <Button size="sm" variant="danger" disabled={saving} onClick={() => apply(() => PhoenixControlDeckConfigurationSchema.parse(removeControlDeck(draft, deck.id).configuration))}>Confirm delete</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setDeleting(undefined)}>Cancel</Button>
              </Inline></ControlContext>}</td>
            </tr>
          })}</tbody>
        </DataTable>
      </DataTableGroup>
      <ControlContext density="compact"><Inline justify="end" gap="xs">
        <Button variant="outline" disabled={!dirty || saving} onClick={() => { setDraft(controller.configuration); setDirty(false); setError(undefined); setDeleting(undefined) }}>Cancel</Button>
        <Button variant="primary" disabled={!dirty || saving} busy={saving} onClick={() => void save()}>Save changes</Button>
      </Inline></ControlContext>
    </>}
  </PageFrame>
}

/** Deck order is the flat PHOENIX navigation order, independent of group metadata. */
export function reorderDeck(configuration: PhoenixControlDeckConfiguration, from: number, to: number): PhoenixControlDeckConfiguration {
  const decks = [...configuration.decks]
  const [deck] = decks.splice(from, 1)
  decks.splice(to, 0, deck!)
  return { ...configuration, decks }
}
