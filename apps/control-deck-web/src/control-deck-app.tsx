import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  ControlDeckConfigurationSchema,
  createControlDeckClientId,
  type ControlDeckCommandExecutionResult,
  type ControlDeckCommandCatalogue,
  type ControlDeckCommandElement,
  type ControlDeckColorScheme,
  type ControlDeckConfiguration,
  type ControlDeckDeck,
  type ControlDeckDeckGroup
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
  const rememberedSubdecks = useRef(new Map<string, string>())

  const load = async () => {
    const status = await api.status()
    setAuthenticated(status.authenticated)
    if (!status.authenticated) return
    const [loadedConfiguration, nextCatalogue] = await Promise.all([api.configuration(), api.commands()])
    const nextConfiguration = normalizeDeckHierarchy(loadedConfiguration)
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
  const group = configuration.groups?.find(candidate => candidate.id === deck?.groupId)
  const subdecks = configuration.decks.filter(candidate => candidate.groupId === group?.id)
  const addSubdeck = () => {
    if (!group) return
    const next = createSubdeck(configuration, group.id)
    void save(next.configuration)
    rememberedSubdecks.current.set(group.id, next.deck.id)
    setActiveDeckId(next.deck.id)
    setEditing(true)
  }
  const save = async (candidate: ControlDeckConfiguration) => {
    try {
      const saved = await api.saveConfiguration(ControlDeckConfigurationSchema.parse(candidate))
      setConfiguration(saved)
      setError(undefined)
      setMessage('Saved')
      globalThis.setTimeout(() => setMessage(undefined), 1_500)
    } catch (cause) { setError(errorMessage(cause)) }
  }
  const execute = async (element: ControlDeckCommandElement, operation: 'tap' | 'press' | 'release', leaseId?: string) => {
    try {
      const result = await api.execute(element.target, operation, leaseId)
      const failure = commandFailureMessage(result)
      if (failure) { setError(failure); return }
      setError(undefined)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  return <main className={`app-shell theme-${group?.appearance?.colorScheme ?? deck?.appearance?.colorScheme ?? 'blue'}`}>
    <header>
      <div><strong>CONTROL DECK</strong><small>Standalone cockpit surface</small></div>
      <div className="navigation-stack">
        <nav aria-label="Decks">
          {(configuration.groups ?? []).map(candidate => <button className={candidate.id === group?.id ? 'active' : ''} key={candidate.id} onClick={() => {
            const remembered = rememberedSubdecks.current.get(candidate.id)
            const nextDeckId = configuration.decks.some(deck => deck.id === remembered && deck.groupId === candidate.id)
              ? remembered
              : configuration.decks.find(deck => deck.groupId === candidate.id)?.id
            setActiveDeckId(nextDeckId)
            setEditingCell(undefined)
          }}>{candidate.name}</button>)}
          <button aria-label="Add deck" onClick={() => {
            const next = createDeckGroup(configuration)
            void save(next.configuration)
            setActiveDeckId(next.deck.id)
            setEditing(true)
          }}>+</button>
        </nav>
      </div>
      <div className="header-actions">
        <button
          aria-label={editing ? 'Finish editing' : 'Edit deck'}
          aria-pressed={editing}
          className="edit-toggle"
          title={editing ? 'Finish editing' : 'Edit deck'}
          onClick={() => { setEditing(value => !value); setEditingCell(undefined) }}
        ><EditIcon active={editing} /></button>
        <FullscreenButton onError={setError} />
      </div>
    </header>
    <FeedbackSlot error={error} message={message} />
    {!deck
      ? <section className="empty"><h1>Build your first deck</h1><p>Add a deck, then assign keyboard commands to its buttons.</p></section>
      : <section className={`deck-workspace${editing ? ' editing' : ''}${subdecks.length > 1 ? ' with-subdeck-rail' : ''}`}>
          {group && subdecks.length > 1 && <nav aria-label="Subdecks" className="subdeck-navigation">
            {subdecks.map(candidate => <button className={candidate.id === deck.id ? 'active' : ''} key={candidate.id} onClick={() => {
              rememberedSubdecks.current.set(group.id, candidate.id)
              setActiveDeckId(candidate.id)
              setEditingCell(undefined)
            }}>{candidate.name}</button>)}
            <button aria-label={`Add subdeck to ${group.name}`} onClick={addSubdeck}>+</button>
          </nav>}
          {editing && group && <DeckSettings deck={deck} group={group} onAddSubdeck={subdecks.length === 1 ? addSubdeck : undefined} onChange={updated => void save(replaceDeck(configuration, updated))} onGroupChange={updated => void save(replaceGroup(configuration, updated))} onDelete={() => {
            const remainingDecks = configuration.decks.filter(candidate => candidate.id !== deck.id)
            const groupStillExists = remainingDecks.some(candidate => candidate.groupId === group.id)
            const next = {
              ...configuration,
              groups: groupStillExists ? configuration.groups : configuration.groups?.filter(candidate => candidate.id !== group.id),
              decks: remainingDecks,
              displays: configuration.displays.map(display => display.deckId === deck.id ? { ...display, deckId: null } : display)
            }
            const nextDeckId = remainingDecks.find(candidate => candidate.groupId === group.id)?.id ?? remainingDecks[0]?.id
            if (nextDeckId && groupStillExists) rememberedSubdecks.current.set(group.id, nextDeckId)
            else rememberedSubdecks.current.delete(group.id)
            setActiveDeckId(nextDeckId)
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
                void execute(element, 'press', leaseId)
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
        </section>}
  </main>
}

function EditIcon ({ active }: { active: boolean }) {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <path d={active ? 'M5 12.5l4 4L19 6.5' : 'M4 20h4L19 9l-4-4L4 16v4M13.5 6.5l4 4'} stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.75" />
  </svg>
}

export function FullscreenButton ({ onError, documentSource = globalThis.document }: {
  onError(message: string): void
  documentSource?: Document
}) {
  const [active, setActive] = useState(documentSource.fullscreenElement !== null)
  const supported = typeof documentSource.documentElement.requestFullscreen === 'function' &&
    typeof documentSource.exitFullscreen === 'function'
  useEffect(() => {
    const synchronize = () => setActive(documentSource.fullscreenElement !== null)
    documentSource.addEventListener('fullscreenchange', synchronize)
    return () => documentSource.removeEventListener('fullscreenchange', synchronize)
  }, [documentSource])

  return <button
    aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
    aria-pressed={active}
    className="fullscreen-toggle"
    disabled={!supported}
    title={supported ? (active ? 'Exit fullscreen' : 'Enter fullscreen') : 'Fullscreen is unavailable in this browser.'}
    onClick={() => {
      void toggleFullscreen(documentSource).catch(cause => onError(errorMessage(cause)))
    }}
  ><FullscreenIcon active={active} /></button>
}

function FullscreenIcon ({ active }: { active: boolean }) {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <path d={active
      ? 'M9 3v6H3m12-6v6h6m-6 12v-6h6M9 21v-6H3'
      : 'M9 3H3v6m12-6h6v6m0 6v6h-6M3 15v6h6'} stroke="currentColor" strokeLinecap="square" strokeWidth="1.75" />
  </svg>
}

export async function toggleFullscreen (documentSource: Document): Promise<void> {
  if (documentSource.fullscreenElement) {
    if (typeof documentSource.exitFullscreen !== 'function') throw new Error('This browser cannot exit fullscreen mode.')
    await documentSource.exitFullscreen()
    return
  }
  if (typeof documentSource.documentElement.requestFullscreen !== 'function') {
    throw new Error('Fullscreen is unavailable in this browser.')
  }
  await documentSource.documentElement.requestFullscreen({ navigationUI: 'hide' })
}

export function FeedbackSlot ({ error, message }: { error?: string, message?: string }) {
  if (!error && !message) return null
  return <p aria-live="polite" className={error ? 'notice error' : 'notice'}>{error ?? message}</p>
}

function Pairing ({ onClaim, error }: { onClaim(code: string): Promise<void>, error?: string }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="center pairing"><form onSubmit={event => { event.preventDefault(); setBusy(true); void onClaim(code).finally(() => setBusy(false)) }}><strong>CONTROL DECK</strong><h1>Pair this display</h1><p>Enter the pairing code shown by the Control Deck server.</p><input autoFocus aria-label="Pairing code" value={code} onChange={event => setCode(event.target.value)} /><button disabled={busy || !code.trim()}>{busy ? 'Pairing…' : 'Pair display'}</button>{error && <p className="error">{error}</p>}</form></main>
}

export function DeckSettings ({ deck, group, onAddSubdeck, onChange, onGroupChange, onDelete }: {
  deck: ControlDeckDeck
  group: ControlDeckDeckGroup
  onAddSubdeck?(): void
  onChange(deck: ControlDeckDeck): void
  onGroupChange(group: ControlDeckDeckGroup): void
  onDelete(): void
}) {
  const [groupName, setGroupName] = useState(group.name)
  const [name, setName] = useState(deck.name)
  const [columns, setColumns] = useState(String(deck.layout.columns))
  const [rows, setRows] = useState(String(deck.layout.rows))
  const minimumColumns = Math.max(1, ...deck.elements.map(element => element.placement.column + element.placement.columnSpan - 1))
  const minimumRows = Math.max(1, ...deck.elements.map(element => element.placement.row + element.placement.rowSpan - 1))
  useEffect(() => { setGroupName(group.name) }, [group.id, group.name])
  useEffect(() => { setName(deck.name) }, [deck.id, deck.name])
  useEffect(() => { setColumns(String(deck.layout.columns)) }, [deck.id, deck.layout.columns])
  useEffect(() => { setRows(String(deck.layout.rows)) }, [deck.id, deck.layout.rows])

  const commitGroupName = () => {
    const next = groupName.trim()
    if (!next) { setGroupName(group.name); return }
    if (next !== group.name) onGroupChange({ ...group, name: next })
  }
  const commitName = () => {
    const next = name.trim()
    if (!next) { setName(deck.name); return }
    if (next !== deck.name) onChange({ ...deck, name: next })
  }
  const commitDimension = (field: 'columns' | 'rows') => {
    const value = field === 'columns' ? columns : rows
    const minimum = field === 'columns' ? minimumColumns : minimumRows
    const parsed = /^\d+$/u.test(value) ? Number(value) : Number.NaN
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > 24) {
      if (field === 'columns') setColumns(String(deck.layout.columns))
      else setRows(String(deck.layout.rows))
      return
    }
    if (parsed !== deck.layout[field]) onChange({
      ...deck,
      layout: { ...deck.layout, [field]: parsed }
    })
  }
  const commitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return <section className="deck-settings">
    <label>Deck<input value={groupName} onBlur={commitGroupName} onChange={event => setGroupName(event.target.value)} onKeyDown={commitOnEnter} /></label>
    <label>Subdeck<input value={name} onBlur={commitName} onChange={event => setName(event.target.value)} onKeyDown={commitOnEnter} /></label>
    <label>Columns<input inputMode="numeric" max="24" min={minimumColumns} type="number" value={columns} onBlur={() => commitDimension('columns')} onChange={event => setColumns(event.target.value)} onKeyDown={commitOnEnter} /></label>
    <label>Rows<input inputMode="numeric" max="24" min={minimumRows} type="number" value={rows} onBlur={() => commitDimension('rows')} onChange={event => setRows(event.target.value)} onKeyDown={commitOnEnter} /></label>
    <label>Theme<select value={group.appearance?.colorScheme ?? deck.appearance?.colorScheme ?? 'blue'} onChange={event => onGroupChange({
      ...group,
      appearance: { colorScheme: event.target.value as ControlDeckColorScheme }
    })}>{COLOR_SCHEMES.map(color => <option key={color.id} value={color.id}>{color.label}</option>)}</select></label>
    {onAddSubdeck && <button onClick={onAddSubdeck}>+ Subdeck</button>}
    <button className="danger" onClick={onDelete}>Delete</button>
  </section>
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
  const finishPointer = (event?: { currentTarget?: { blur(): void } }) => {
    event?.currentTarget?.blur()
    setPressed(false)
    if (armingTimer.current) globalThis.clearTimeout(armingTimer.current)
    armingTimer.current = undefined
    if (suppressClick.current) {
      globalThis.setTimeout(() => { suppressClick.current = false }, 0)
    }
    if (!editing && element.interaction.confirmation.kind === 'none' && element.interaction.activation === 'hold') {
      onHoldEnd()
    }
  }
  const style = {
    '--button-accent': element.appearance.foregroundColor ?? undefined,
    '--button-background': element.appearance.backgroundColor ?? undefined
  } as CSSProperties
  return <button className={`deck-button${armed ? ' armed' : ''}${pressed ? ' pressed' : ''}`} style={style} onClick={activate} onContextMenu={event => event.preventDefault()} onPointerDown={event => {
    if (editing) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setPressed(true)
    if (element.interaction.confirmation.kind === 'arm-then-tap') {
      armingTimer.current = globalThis.setTimeout(() => {
        suppressClick.current = true
        setPressed(false)
        setArmed(true)
        expiryTimer.current = globalThis.setTimeout(() => setArmed(false), element.interaction.confirmation.kind === 'arm-then-tap' ? element.interaction.confirmation.armedForMs : 5_000)
      }, 650)
    } else if (element.interaction.activation === 'hold') {
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
  const [color, setColor] = useState(buttonColorId(element))
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
      foregroundColor: BUTTON_COLORS[color]?.foreground ?? null,
      backgroundColor: BUTTON_COLORS[color]?.background ?? null
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
      {([['LeftControl', 'Ctrl'], ['RightControl', 'RCtrl'], ['LeftShift', 'Shift'], ['RightShift', 'RShift'], ['LeftAlt', 'Alt'], ['RightAlt', 'RAlt']] as const).map(([value, text]) =>
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
    <label>Color<select value={color} onChange={event => setColor(event.target.value)}>
      <option value="default">Deck default</option>
      {COLOR_SCHEMES.map(color => <option key={color.id} value={color.id}>{color.label}</option>)}
    </select></label>
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
  return ({ ArrowDown: 'DownArrow', ArrowLeft: 'LeftArrow', ArrowRight: 'RightArrow', ArrowUp: 'UpArrow', Backspace: 'BackSpace', CapsLock: 'CapsLock', Delete: 'Delete', End: 'End', Enter: 'Enter', Esc: 'Escape', Escape: 'Escape', Home: 'Home', Insert: 'Insert', PageDown: 'PageDown', PageUp: 'PageUp', Tab: 'Tab' } as Record<string, string>)[key] ?? (/^F(?:[1-9]|1[0-9]|2[0-4])$/u.test(key) ? key : null)
}
function modifierLabel (modifier: string): string { return ({ LeftAlt: 'Alt', LeftControl: 'Ctrl', LeftShift: 'Shift', RightAlt: 'RAlt', RightControl: 'RCtrl', RightShift: 'RShift' } as Record<string, string>)[modifier] ?? modifier }

const COLOR_SCHEMES: ReadonlyArray<{ id: ControlDeckColorScheme, label: string }> = [
  { id: 'blue', label: 'Blue' },
  { id: 'cyan', label: 'Cyan' },
  { id: 'green', label: 'Green' },
  { id: 'amber', label: 'Amber' },
  { id: 'orange', label: 'Orange' },
  { id: 'red', label: 'Red' },
  { id: 'violet', label: 'Violet' },
  { id: 'magenta', label: 'Magenta' }
]

const BUTTON_COLORS: Readonly<Record<string, { foreground: string, background: string }>> = {
  blue: { foreground: '#55c7ff', background: '#123247' },
  cyan: { foreground: '#45e0dc', background: '#103638' },
  green: { foreground: '#62d88d', background: '#143522' },
  amber: { foreground: '#ffb84d', background: '#3b2b0d' },
  orange: { foreground: '#ff8a4c', background: '#3b2113' },
  red: { foreground: '#ff6258', background: '#3a1717' },
  violet: { foreground: '#a98cff', background: '#271f3d' },
  magenta: { foreground: '#f06bd8', background: '#3a1832' }
}

function buttonColorId (element?: ControlDeckCommandElement): string {
  if (!element) return 'default'
  return Object.entries(BUTTON_COLORS).find(([, value]) =>
    value.foreground === element.appearance.foregroundColor && value.background === element.appearance.backgroundColor
  )?.[0] ?? 'default'
}

export function commandFailureMessage (result: ControlDeckCommandExecutionResult): string | undefined {
  return ['cancelled', 'failed', 'rejected', 'timed_out'].includes(result.status) ? result.message : undefined
}

function commandLabel (element: ControlDeckCommandElement, catalogue: ControlDeckCommandCatalogue): string { return catalogue.adapters.find(adapter => adapter.id === element.target.adapterId)?.commands.find(command => command.id === element.target.commandId)?.label ?? element.target.commandId }
function elementAt (deck: ControlDeckDeck, column: number, row: number) { return deck.elements.find(element => element.kind === 'command' && element.placement.column === column && element.placement.row === row) as ControlDeckCommandElement | undefined }
function upsertElement (deck: ControlDeckDeck, next: ControlDeckCommandElement): ControlDeckDeck { return { ...deck, elements: deck.elements.some(element => element.id === next.id) ? deck.elements.map(element => element.id === next.id ? next : element) : [...deck.elements, next] } }
function replaceDeck (configuration: ControlDeckConfiguration, deck: ControlDeckDeck): ControlDeckConfiguration { return { ...configuration, decks: configuration.decks.map(candidate => candidate.id === deck.id ? deck : candidate) } }
function replaceGroup (configuration: ControlDeckConfiguration, group: ControlDeckDeckGroup): ControlDeckConfiguration { return { ...configuration, groups: configuration.groups?.map(candidate => candidate.id === group.id ? group : candidate) } }

export function normalizeDeckHierarchy (configuration: ControlDeckConfiguration): ControlDeckConfiguration & { groups: ControlDeckDeckGroup[] } {
  const groups = [...(configuration.groups ?? [])]
  const groupIds = new Set(groups.map(group => group.id))
  const decks = configuration.decks.map(deck => {
    if (deck.groupId) return deck
    const groupId = uniqueEntityId(deck.id, groupIds)
    groupIds.add(groupId)
    groups.push({
      id: groupId,
      name: deck.name,
      description: deck.description,
      ...(deck.appearance ? { appearance: deck.appearance } : {})
    })
    return { ...deck, groupId, name: '01' }
  })
  return { ...configuration, groups, decks }
}

export function createDeckGroup (configuration: ControlDeckConfiguration) {
  const groups = configuration.groups ?? []
  const groupId = uniqueEntityId(`deck_${Date.now().toString(36)}`, new Set(groups.map(group => group.id)))
  const group: ControlDeckDeckGroup = {
    id: groupId,
    name: `Deck ${groups.length + 1}`,
    description: '',
    appearance: { colorScheme: 'blue' }
  }
  const deck = blankSubdeck(groupId, '01')
  return {
    group,
    deck,
    configuration: { ...configuration, groups: [...groups, group], decks: [...configuration.decks, deck] }
  }
}

export function createSubdeck (configuration: ControlDeckConfiguration, groupId: string) {
  const siblings = configuration.decks.filter(deck => deck.groupId === groupId)
  const names = new Set(siblings.map(deck => deck.name))
  let ordinal = 1
  while (names.has(String(ordinal).padStart(2, '0'))) ordinal++
  const deck = blankSubdeck(groupId, String(ordinal).padStart(2, '0'))
  return { deck, configuration: { ...configuration, decks: [...configuration.decks, deck] } }
}

function blankSubdeck (groupId: string, name: string): ControlDeckDeck {
  return {
    id: `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    groupId,
    name,
    description: '',
    context: null,
    layout: { kind: 'grid', columns: 4, rows: 3 },
    elements: []
  }
}

function uniqueEntityId (preferred: string, existing: ReadonlySet<string>): string {
  if (!existing.has(preferred)) return preferred
  for (let suffix = 2; suffix < 1_000; suffix++) {
    const candidate = `${preferred.slice(0, 63 - String(suffix).length)}_${suffix}`
    if (!existing.has(candidate)) return candidate
  }
  throw new Error(`Could not allocate an id for ${preferred}.`)
}
function errorMessage (cause: unknown) { return cause instanceof Error ? cause.message : 'Control Deck operation failed.' }
