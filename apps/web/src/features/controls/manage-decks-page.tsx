import { useEffect, useState } from 'react'
import { createControlDeckGroup, removeControlDeck, replaceControlDeckGroup } from 'control-deck/core'
import { PhoenixControlDeckConfigurationSchema, type PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import { Breadcrumbs, Button, IconButton, Inline, InputGroup, Loading, PageFrame, PageHeader, PencilIcon, TextInput, Toast, TrashIcon, Widget } from '@phoenix/ui'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'
import { useDeckReorder } from './use-deck-reorder.js'
import { useDeckAutosave } from './use-deck-autosave.js'

export function ManageDecksPage({ controller, onSave, onEdit }: {
  controller: ControlsControllerSnapshot
  onSave(configuration: PhoenixControlDeckConfiguration): Promise<PhoenixControlDeckConfiguration>
  onEdit(deckId: string): void
}) {
  const { draft, saving, error, setError, change: update, flush } = useDeckAutosave(controller.configuration, onSave)
  const [deleting, setDeleting] = useState<string>()
  const messages = [...(error ? [error.message] : []), ...(controller.status === 'error' && controller.error ? [controller.error] : [])]
  const messageKey = messages.join('\u0000')
  const [dismissed, setDismissed] = useState<string>()
  useEffect(() => { if (!messageKey) setDismissed(undefined) }, [messageKey])
  const change = (configuration: PhoenixControlDeckConfiguration, typing = false) => {
    update(configuration, typing); setDeleting(undefined)
  }
  const apply = (operation: () => PhoenixControlDeckConfiguration) => {
    try { change(operation()) }
    catch (cause) { setError({ message: cause instanceof Error ? cause.message : 'Unable to update decks.', tone: 'warning' }) }
  }
  const move = useDeckReorder(draft?.decks.map(deck => deck.id) ?? [], !saving, (from, to) => {
    if (draft) change(reorderDeck(draft, from, to))
  })
  const create = () => {
    if (!draft) return
    apply(() => {
      const created = createControlDeckGroup(draft)
      return PhoenixControlDeckConfigurationSchema.parse(replaceControlDeckGroup(created.configuration,
        { ...created.group, name: 'New deck', appearance: undefined }))
    })
  }
  const editDeck = async (deckId: string) => {
    if (await flush()) onEdit(deckId)
  }
  return <PageFrame layout="fit" className="manage-decks-page">
    <PageHeader context={<Breadcrumbs items={[{ label: 'Controls' }, { label: 'Manage decks' }]} />}
      title="Manage decks" variant="cockpit" actions={<IconButton variant="primary" label="New deck" disabled={!draft || saving || draft.decks.length >= 256} onClick={create}>+</IconButton>} />
    {messages.length > 0 && messageKey !== dismissed && <Toast messages={messages}
      tone={controller.status === 'error' ? 'danger' : error!.tone} onDismiss={() => setDismissed(messageKey)} />}
    {!draft ? <Loading>Loading decks…</Loading> : <>
      <div className="deck-list" aria-label="Control decks" ref={move.list} {...move.events} data-deskplane-no-swipe>
          {draft.decks.map((deck, index) => {
            const group = draft.groups?.find(group => group.id === deck.groupId)
            const name = group?.name ?? deck.name
            const moving = move.preview?.id === deck.id
            const destination = move.preview?.target === deck.id
            const sourceIndex = draft.decks.findIndex(candidate => candidate.id === move.preview?.id)
            return <Widget key={deck.id} aria-label={`Deck ${index + 1}: ${name}`} data-deck-id={deck.id}
              className={`deck-card${moving ? ' moving' : ''}${destination ? sourceIndex < index ? ' drop-after' : ' drop-before' : ''}`}
              style={moving ? { transform: `translateY(${move.preview!.offset}px)` } : undefined}>
              <div className="deck-row">
              <InputGroup className="filled" htmlFor={`deck-name-${deck.id}`} label={<span className="deck-grip" role="button" tabIndex={saving ? -1 : 0} aria-label={`Reorder ${name}`} aria-disabled={saving}
                title="Drag to reorder; use up/down arrow keys when focused"
                onClick={event => event.preventDefault()}
                onPointerDown={event => move.begin(event, deck.id)} onKeyDown={event => move.keyboard(event, index)}><span aria-hidden="true" /></span>}>
                <TextInput id={`deck-name-${deck.id}`} aria-label={`Deck name ${index + 1}`} value={name}
                maxLength={80} onChange={event => change(group ? { ...draft,
                  groups: draft.groups!.map(candidate => candidate.id === group.id ? { ...candidate, name: event.target.value } : candidate) }
                  : { ...draft, decks: draft.decks.map(candidate => candidate.id === deck.id ? { ...candidate, name: event.target.value } : candidate) }, true)} />
              </InputGroup>
              <Inline className="deck-actions" gap="md" wrap={false}>
                <IconButton variant="outline" label={`Edit ${name}`} disabled={saving} onClick={() => void editDeck(deck.id)}><PencilIcon /></IconButton>
                <IconButton variant="danger" label={`Delete ${name}`} disabled={saving || draft.decks.length === 1} onClick={() => setDeleting(deck.id)}><TrashIcon /></IconButton>
              </Inline>
              </div>
              {deleting === deck.id && <Inline className="deck-confirm" gap="xs">
                <span>Delete this deck and its buttons?</span>
                <Button variant="danger" disabled={saving} onClick={() => apply(() => PhoenixControlDeckConfigurationSchema.parse(removeControlDeck(draft, deck.id).configuration))}>Confirm delete</Button>
                <Button variant="outline" disabled={saving} onClick={() => setDeleting(undefined)}>Cancel</Button>
              </Inline>}
            </Widget>
          })}
      </div>
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
