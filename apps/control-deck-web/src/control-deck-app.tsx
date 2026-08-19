import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ControlDeckConfigurationSchema,
  createControlDeckClientId,
  type ControlDeckCommandCatalogue,
  type ControlDeckCommandElement,
  type ControlDeckConfiguration,
  type ControlDeckDeck
} from '@jdu/control-deck-core'
import { ControlDeckSurface } from '@jdu/control-deck-ui'
import type { ControlDeckApi } from './api.js'

export function ControlDeckApp ({ api }: { api: ControlDeckApi }) {
  const [authenticated, setAuthenticated] = useState<boolean>()
  const [configuration, setConfiguration] = useState<ControlDeckConfiguration>()
  const [catalogue, setCatalogue] = useState<ControlDeckCommandCatalogue>()
  const [activeDeckId, setActiveDeckId] = useState<string>()
  const [editing, setEditing] = useState(false)
  const [editingCell, setEditingCell] = useState<{ column: number, row: number }>()
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const held = useRef(new Map<string, string>())

  const load = async () => {
    const status = await api.status()
    setAuthenticated(status.authenticated)
    if (!status.authenticated) return
    const [nextConfiguration, nextCatalogue] = await Promise.all([api.configuration(), api.commands()])
    setConfiguration(nextConfiguration)
    setCatalogue(nextCatalogue)
    setActiveDeckId(current => nextConfiguration.decks.some(deck => deck.id === current)
      ? current
      : nextConfiguration.decks[0]?.id)
  }
  useEffect(() => { void load().catch(cause => setError(errorMessage(cause))) }, [])

  if (authenticated === undefined) return <main className="center"><p>Connecting to Control Deck…</p></main>
  if (!authenticated) return <Pairing onClaim={async code => { await api.claim(code); await load() }} error={error} />
  if (!configuration || !catalogue) return <main className="center"><p>Loading decks…</p></main>

  const deck = configuration.decks.find(candidate => candidate.id === activeDeckId)
  const save = async (candidate: ControlDeckConfiguration) => {
    try {
      const saved = await api.saveConfiguration(ControlDeckConfigurationSchema.parse(candidate))
      setConfiguration(saved)
      setError(undefined)
      setMessage('Saved')
      window.setTimeout(() => setMessage(undefined), 1_500)
    } catch (cause) { setError(errorMessage(cause)) }
  }
  const execute = async (element: ControlDeckCommandElement, operation: 'tap' | 'press' | 'release', leaseId?: string, report = true) => {
    try {
      const result = await api.execute(element.target, operation, leaseId)
      if (report) setMessage(result.message)
      setError(undefined)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  return <main className="app-shell">
    <header>
      <div><strong>CONTROL DECK</strong><small>Standalone cockpit surface</small></div>
      <nav>
        {configuration.decks.map(candidate => <button className={candidate.id === deck?.id ? 'active' : ''} key={candidate.id} onClick={() => { setActiveDeckId(candidate.id); setEditingCell(undefined) }}>{candidate.name}</button>)}
        <button onClick={() => {
          const next = createDeck(configuration)
          void save(next.configuration)
          setActiveDeckId(next.deck.id)
          setEditing(true)
        }}>+ Deck</button>
      </nav>
      <button className="edit-toggle" onClick={() => { setEditing(value => !value); setEditingCell(undefined) }}>{editing ? 'Done' : 'Edit'}</button>
    </header>
    {(error || message) && <p className={error ? 'notice error' : 'notice'}>{error ?? message}</p>}
    {!deck
      ? <section className="empty"><h1>Build your first deck</h1><p>Add a deck, then assign keyboard commands to its buttons.</p></section>
      : <>
          {editing && <DeckSettings deck={deck} onChange={updated => void save(replaceDeck(configuration, updated))} onDelete={() => {
            const next = { ...configuration, decks: configuration.decks.filter(candidate => candidate.id !== deck.id), displays: configuration.displays.map(display => display.deckId === deck.id ? { ...display, deckId: null } : display) }
            setActiveDeckId(next.decks[0]?.id)
            void save(next)
          }} />}
          <ControlDeckSurface
            aria-label={`${deck.name} controls`}
            className="standalone-deck"
            deck={deck}
            renderEmpty={({ column, row }) => editing
              ? <button className="empty-button" onClick={() => setEditingCell({ column, row })}>+</button>
              : <span />}
            renderCommand={element => <DeckButton
              editing={editing}
              element={element}
              label={commandLabel(element, catalogue)}
              onEdit={() => setEditingCell({ column: element.placement.column, row: element.placement.row })}
              onTap={() => void execute(element, 'tap')}
              onHoldStart={() => {
                const leaseId = createControlDeckClientId()
                held.current.set(element.id, leaseId)
                void execute(element, 'press', leaseId, false)
              }}
              onHoldEnd={() => {
                const leaseId = held.current.get(element.id)
                if (!leaseId) return
                held.current.delete(element.id)
                void execute(element, 'release', leaseId)
              }}
            />}
          />
          {editingCell && <ButtonEditor
            deck={deck}
            element={elementAt(deck, editingCell.column, editingCell.row)}
            position={editingCell}
            onClose={() => setEditingCell(undefined)}
            onSave={element => { void save(replaceDeck(configuration, upsertElement(deck, element))); setEditingCell(undefined) }}
            onRemove={() => {
              const existing = elementAt(deck, editingCell.column, editingCell.row)
              if (existing) void save(replaceDeck(configuration, { ...deck, elements: deck.elements.filter(element => element.id !== existing.id) }))
              setEditingCell(undefined)
            }}
          />}
        </>}
  </main>
}

function Pairing ({ onClaim, error }: { onClaim(code: string): Promise<void>, error?: string }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="center pairing"><form onSubmit={event => { event.preventDefault(); setBusy(true); void onClaim(code).finally(() => setBusy(false)) }}><strong>CONTROL DECK</strong><h1>Pair this display</h1><p>Enter the pairing code shown by the Control Deck server.</p><input autoFocus aria-label="Pairing code" value={code} onChange={event => setCode(event.target.value)} /><button disabled={busy || !code.trim()}>{busy ? 'Pairing…' : 'Pair display'}</button>{error && <p className="error">{error}</p>}</form></main>
}

function DeckSettings ({ deck, onChange, onDelete }: { deck: ControlDeckDeck, onChange(deck: ControlDeckDeck): void, onDelete(): void }) {
  const minimumColumns = Math.max(1, ...deck.elements.map(element => element.placement.column + element.placement.columnSpan - 1))
  const minimumRows = Math.max(1, ...deck.elements.map(element => element.placement.row + element.placement.rowSpan - 1))
  return <section className="deck-settings"><label>Name<input value={deck.name} onChange={event => onChange({ ...deck, name: event.target.value || 'Untitled deck' })} /></label><label>Columns<input type="number" min={minimumColumns} max="24" value={deck.layout.columns} onChange={event => onChange({ ...deck, layout: { ...deck.layout, columns: Number(event.target.value) } })} /></label><label>Rows<input type="number" min={minimumRows} max="24" value={deck.layout.rows} onChange={event => onChange({ ...deck, layout: { ...deck.layout, rows: Number(event.target.value) } })} /></label><button className="danger" onClick={onDelete}>Delete deck</button></section>
}

export function DeckButton ({ editing, element, label, onEdit, onTap, onHoldStart, onHoldEnd }: { editing: boolean, element: ControlDeckCommandElement, label: string, onEdit(): void, onTap(): void, onHoldStart(): void, onHoldEnd(): void }) {
  const [armed, setArmed] = useState(false)
  const [pressed, setPressed] = useState(false)
  const armingTimer = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined)
  const expiryTimer = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined)
  const suppressClick = useRef(false)
  const labelText = element.appearance.label ?? label
  useEffect(() => () => {
    if (armingTimer.current) globalThis.clearTimeout(armingTimer.current)
    if (expiryTimer.current) globalThis.clearTimeout(expiryTimer.current)
  }, [])
  const activate = () => {
    if (editing) { onEdit(); return }
    if (suppressClick.current) { suppressClick.current = false; return }
    if (element.interaction.confirmation.kind === 'arm-then-tap') {
      if (!armed) return
      setArmed(false)
      if (expiryTimer.current) globalThis.clearTimeout(expiryTimer.current)
      onTap()
      return
    }
    if (element.interaction.activation !== 'hold') onTap()
  }
  const finishPointer = () => {
    if (armingTimer.current) globalThis.clearTimeout(armingTimer.current)
    armingTimer.current = undefined
    if (!editing && element.interaction.confirmation.kind === 'none' && element.interaction.activation === 'hold') {
      setPressed(false)
      onHoldEnd()
    }
  }
  return <button className={`deck-button${armed ? ' armed' : ''}${pressed ? ' pressed' : ''}`} onClick={activate} onContextMenu={event => event.preventDefault()} onPointerDown={event => {
    if (editing) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (element.interaction.confirmation.kind === 'arm-then-tap') {
      armingTimer.current = globalThis.setTimeout(() => {
        suppressClick.current = true
        setArmed(true)
        expiryTimer.current = globalThis.setTimeout(() => setArmed(false), element.interaction.confirmation.kind === 'arm-then-tap' ? element.interaction.confirmation.armedForMs : 5_000)
      }, 650)
    } else if (element.interaction.activation === 'hold') {
      setPressed(true)
      onHoldStart()
    }
  }} onPointerUp={finishPointer} onPointerCancel={finishPointer}><strong>{armed ? 'ARMED — TAP' : labelText}</strong><small>{element.target.configuration.key as string ?? element.target.commandId}</small></button>
}

export function ButtonEditor ({ element, position, onClose, onSave, onRemove }: { deck: ControlDeckDeck, element?: ControlDeckCommandElement, position: { column: number, row: number }, onClose(): void, onSave(element: ControlDeckCommandElement): void, onRemove(): void }) {
  const [label, setLabel] = useState(element?.appearance.label ?? '')
  const [key, setKey] = useState(typeof element?.target.configuration.key === 'string' ? element.target.configuration.key : '')
  const [modifiers, setModifiers] = useState<string[]>(Array.isArray(element?.target.configuration.modifiers) ? element.target.configuration.modifiers as string[] : [])
  const [activation, setActivation] = useState(element?.interaction.activation ?? 'tap')
  const [confirmation, setConfirmation] = useState(element?.interaction.confirmation.kind ?? 'none')
  const captureShortcut = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isModifierKey(event.key)) return
    const shortcutKey = browserKeyToControlDeckKey(event.key)
    if (!shortcutKey) return
    event.preventDefault()
    setKey(shortcutKey)
    setModifiers([
      ...(event.ctrlKey ? ['LeftControl'] : []),
      ...(event.shiftKey ? ['LeftShift'] : []),
      ...(event.altKey ? ['LeftAlt'] : [])
    ])
  }
  const saveButton = () => onSave({
    id: element?.id ?? `element_${Date.now().toString(36)}`,
    kind: 'command',
    target: {
      adapterId: 'builtin.keyboard',
      commandId: 'key',
      configuration: { key: key.trim(), modifiers }
    },
    placement: element?.placement ?? {
      kind: 'grid',
      column: position.column,
      row: position.row,
      columnSpan: 1,
      rowSpan: 1
    },
    appearance: {
      label: label.trim(),
      icon: null,
      foregroundColor: null,
      backgroundColor: null
    },
    interaction: {
      activation,
      confirmation: confirmation === 'arm-then-tap'
        ? { kind: confirmation, armedForMs: 5_000 }
        : { kind: 'none' }
    }
  })

  return <section aria-modal="true" className="button-editor" role="dialog">
    <header><strong>Button {position.column}:{position.row}</strong><button onClick={onClose}>Close</button></header>
    <label>Label<input value={label} onChange={event => setLabel(event.target.value)} /></label>
    <label>Shortcut<input
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      enterKeyHint="done"
      inputMode="text"
      placeholder="Tap here, then press a key"
      value={key}
      onChange={event => setKey(event.target.value)}
      onFocus={event => event.currentTarget.select()}
      onKeyDown={captureShortcut}
    /></label>
    <div className="modifier-picker" aria-label="Shortcut modifiers">
      {([['LeftControl', 'Ctrl'], ['LeftShift', 'Shift'], ['LeftAlt', 'Alt']] as const).map(([value, text]) =>
        <button
          aria-pressed={modifiers.includes(value)}
          className={modifiers.includes(value) ? 'active' : ''}
          key={value}
          onClick={() => setModifiers(current => current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value])}
        >{text}</button>)}
    </div>
    <output className="shortcut-preview">{[...modifiers.map(modifierLabel), key || 'Key'].join(' + ')}</output>
    <label>Activation<select value={activation} onChange={event => {
      const next = event.target.value as 'tap' | 'hold'
      setActivation(next)
      if (next === 'hold') setConfirmation('none')
    }}><option value="tap">Tap</option><option value="hold">Hold while pressed</option></select></label>
    <label>Safety<select disabled={activation === 'hold'} value={confirmation} onChange={event => setConfirmation(event.target.value as 'none' | 'arm-then-tap')}><option value="none">Immediate</option><option value="arm-then-tap">Hold to arm, then tap</option></select></label>
    <footer>{element && <button className="danger" onClick={onRemove}>Remove</button>}<button disabled={!key.trim() || !label.trim()} onClick={saveButton}>Save button</button></footer>
  </section>
}

function isModifierKey (key: string): boolean { return ['Alt', 'Control', 'Meta', 'Shift'].includes(key) }
function browserKeyToControlDeckKey (key: string): string | null {
  if (key.length === 1) return key === ' ' ? 'Space' : key
  return ({ ArrowDown: 'DownArrow', ArrowLeft: 'LeftArrow', ArrowRight: 'RightArrow', ArrowUp: 'UpArrow', Backspace: 'BackSpace', Delete: 'Delete', End: 'End', Enter: 'Enter', Esc: 'Escape', Escape: 'Escape', Home: 'Home', Insert: 'Insert', PageDown: 'PageDown', PageUp: 'PageUp', Tab: 'Tab' } as Record<string, string>)[key] ?? (/^F(?:[1-9]|1[0-9]|2[0-4])$/u.test(key) ? key : null)
}
function modifierLabel (modifier: string): string { return ({ LeftAlt: 'Alt', LeftControl: 'Ctrl', LeftShift: 'Shift' } as Record<string, string>)[modifier] ?? modifier }

function commandLabel (element: ControlDeckCommandElement, catalogue: ControlDeckCommandCatalogue): string { return catalogue.adapters.find(adapter => adapter.id === element.target.adapterId)?.commands.find(command => command.id === element.target.commandId)?.label ?? element.target.commandId }
function elementAt (deck: ControlDeckDeck, column: number, row: number) { return deck.elements.find(element => element.kind === 'command' && element.placement.column === column && element.placement.row === row) as ControlDeckCommandElement | undefined }
function upsertElement (deck: ControlDeckDeck, next: ControlDeckCommandElement): ControlDeckDeck { return { ...deck, elements: deck.elements.some(element => element.id === next.id) ? deck.elements.map(element => element.id === next.id ? next : element) : [...deck.elements, next] } }
function replaceDeck (configuration: ControlDeckConfiguration, deck: ControlDeckDeck): ControlDeckConfiguration { return { ...configuration, decks: configuration.decks.map(candidate => candidate.id === deck.id ? deck : candidate) } }
function createDeck (configuration: ControlDeckConfiguration) { const deck: ControlDeckDeck = { id: `deck_${Date.now().toString(36)}`, name: `Deck ${configuration.decks.length + 1}`, description: '', context: null, layout: { kind: 'grid', columns: 4, rows: 3 }, elements: [] }; return { deck, configuration: { ...configuration, decks: [...configuration.decks, deck] } } }
function errorMessage (cause: unknown) { return cause instanceof Error ? cause.message : 'Control Deck operation failed.' }
