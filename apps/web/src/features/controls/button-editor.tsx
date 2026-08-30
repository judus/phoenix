import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { ControlDeckCommandCatalogue, ControlDeckGridCommandElement } from 'control-deck/core'
import { createClientId } from '../../application/identity/client-identity.js'

interface CommandOption {
  activation: 'tap' | 'hold'
  available: boolean
  bindingLabel?: string | null
  category: string
  commandId: string
  description: string
  label: string
  risk: 'safe' | 'caution' | 'dangerous' | 'destructive'
  unavailableReason: string | null
}

export interface ButtonEditorCommandOptions {
  label: string
  options: CommandOption[]
  selectedCommandId: string
  onSelect(option: CommandOption): void
}

export function ButtonEditor({
  catalogue,
  element,
  placement,
  position,
  renderCommandOptions,
  showBackButton = true,
  showHeader = true,
  onClose,
  onSave,
  onRemove
}: {
  catalogue?: ControlDeckCommandCatalogue
  element?: ControlDeckGridCommandElement
  placement?: ControlDeckGridCommandElement['placement']
  position: { column: number, row: number }
  renderCommandOptions?(options: ButtonEditorCommandOptions): ReactNode
  showBackButton?: boolean
  showHeader?: boolean
  onClose(): void
  onSave(element: ControlDeckGridCommandElement): void
  onRemove(): void
}) {
  const source = commandSource(catalogue, element)
  const initialCommandId = element?.target.commandId ?? (source.commands.length === 1 ? source.commands[0]!.commandId : '')
  const [label, setLabel] = useState(element?.appearance.label ?? '')
  const [selectedCommand, setSelectedCommand] = useState(initialCommandId)
  const [commandFilter, setCommandFilter] = useState('')
  const initialOption = source.commands.find(option => option.commandId === initialCommandId)
  const [confirmation, setConfirmation] = useState<'none' | 'arm-then-tap'>(
    element?.interaction.confirmation.kind ?? (requiresArming(initialOption) ? 'arm-then-tap' : 'none')
  )
  const [armedForSeconds, setArmedForSeconds] = useState(
    element?.interaction.confirmation.kind === 'arm-then-tap'
      ? element.interaction.confirmation.armedForMs / 1_000
      : 5
  )
  const [color, setColor] = useState(buttonColorId(element))
  const selectedOption = source.commands.find(option => option.commandId === selectedCommand)
  const visibleCommandOptions = source.commands.filter(option => commandMatchesFilter(option, commandFilter))
  const activation = selectedOption?.activation ?? element?.interaction.activation ?? 'tap'
  const saveDisabled = !selectedCommand ||
    (confirmation === 'arm-then-tap' && (!Number.isInteger(armedForSeconds) || armedForSeconds < 1 || armedForSeconds > 30))

  const selectCommand = (option: CommandOption) => {
    setSelectedCommand(option.commandId)
    setConfirmation(option.activation === 'hold' ? 'none' : requiresArming(option) ? 'arm-then-tap' : 'none')
  }

  const saveButton = () => onSave({
    id: element?.id ?? `element_${createClientId()}`,
    kind: 'command',
    target: {
      adapterId: source.id,
      commandId: selectedCommand,
      configuration: element?.target.adapterId === source.id && element.target.commandId === selectedCommand
        ? element.target.configuration
        : {}
    },
    placement: element?.placement ?? placement ?? {
      kind: 'grid',
      column: position.column,
      row: position.row,
      columnSpan: 1,
      rowSpan: 1
    },
    appearance: {
      label: label.trim() || null,
      icon: element?.appearance.icon ?? null,
      foregroundColor: BUTTON_COLORS[color]?.foreground ?? null,
      backgroundColor: BUTTON_COLORS[color]?.background ?? null
    },
    interaction: {
      activation,
      confirmation: activation !== 'hold' && confirmation === 'arm-then-tap'
        ? { kind: confirmation, armedForMs: Math.round(armedForSeconds * 1_000) }
        : { kind: 'none' }
    }
  })

  const actions = <>
    <ToolButton iconOnly aria-label="Cancel button editing" title="Cancel" onClick={onClose}><CloseIcon /></ToolButton>
    {element && <ToolButton iconOnly aria-label="Remove button" title="Remove button" variant="delete" onClick={onRemove}><DeleteIcon /></ToolButton>}
    <ToolButton iconOnly aria-label="Save button" disabled={saveDisabled} title="Save button" variant="confirm" onClick={saveButton}><CheckIcon /></ToolButton>
  </>

  return <section aria-label={`Edit button ${position.column}:${position.row}`} className="button-editor">
    {showHeader && <header><strong>Button Slot {position.column}:{position.row}</strong>{showBackButton && <button onClick={onClose}>Back</button>}</header>}
    <div className="command-picker">
      <label>Commands<input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        placeholder={`Search ${source.label} commands`}
        type="search"
        value={commandFilter}
        onChange={event => setCommandFilter(event.target.value)}
      /></label>
      {renderCommandOptions?.({
        label: `${source.label} commands`,
        options: visibleCommandOptions,
        selectedCommandId: selectedCommand,
        onSelect: selectCommand
      })}
    </div>
    <label className="button-editor-label">Label<input
      placeholder={selectedOption ? `Default: ${selectedOption.label}` : 'Button label'}
      value={label}
      onChange={event => setLabel(event.target.value)}
    /></label>
    <div className="button-editor-behavior-group">
      <label className="button-editor-behavior">Behavior<select disabled={activation === 'hold'} value={confirmation} onChange={event => setConfirmation(event.target.value as 'none' | 'arm-then-tap')}>
        <option value="none">Execute immediately</option>
        <option value="arm-then-tap">Require arming before execution</option>
      </select></label>
      {confirmation === 'arm-then-tap' && <label className="button-editor-arming-window">Disarm timeout (seconds)<input
        inputMode="numeric"
        max="30"
        min="1"
        type="number"
        value={armedForSeconds}
        onChange={event => {
          const seconds = Number(event.target.value)
          if (Number.isInteger(seconds) && seconds >= 1 && seconds <= 30) setArmedForSeconds(seconds)
        }}
      /></label>}
    </div>
    <label className="button-editor-color">Color<select value={color} onChange={event => setColor(event.target.value)}>
      <option value="default">Deck default</option>
      {COLOR_SCHEMES.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
    </select></label>
    <footer className="button-editor-actions">{actions}</footer>
  </section>
}

function commandSource(catalogue?: ControlDeckCommandCatalogue, element?: ControlDeckGridCommandElement): { id: string, label: string, commands: CommandOption[] } {
  const adapter = catalogue?.adapters.find(candidate => candidate.id === element?.target.adapterId) ?? catalogue?.adapters[0]
  const source = {
    id: adapter?.id ?? element?.target.adapterId ?? 'phoenix.commands',
    label: adapter?.label ?? 'PHOENIX',
    commands: (adapter?.commands ?? []).map(command => ({
      activation: command.operations.includes('press') && command.operations.includes('release') ? 'hold' as const : 'tap' as const,
      available: Boolean(adapter?.available && command.available),
      bindingLabel: command.bindingLabel,
      category: command.category,
      commandId: command.id,
      description: command.description,
      label: command.label,
      risk: command.risk,
      unavailableReason: adapter?.available ? command.unavailableReason : adapter?.detail ?? null
    }))
  }
  if (element && !source.commands.some(command => command.commandId === element.target.commandId)) {
    source.commands.push({
      activation: element.interaction.activation === 'hold' ? 'hold' : 'tap',
      available: true,
      bindingLabel: undefined,
      category: 'Unavailable',
      commandId: element.target.commandId,
      description: 'This saved command is not present in the current catalogue.',
      label: `${element.target.commandId} (unavailable)`,
      risk: 'safe',
      unavailableReason: null
    })
  }
  return source
}

function requiresArming(option?: CommandOption): boolean {
  return option?.risk === 'dangerous' || option?.risk === 'destructive'
}

function commandMatchesFilter(option: CommandOption, filter: string): boolean {
  const query = filter.trim().toLocaleLowerCase()
  if (!query) return true
  return [option.label, option.category, option.description, option.commandId]
    .some(value => value.toLocaleLowerCase().includes(query))
}

const COLOR_SCHEMES = [
  { id: 'white', label: 'White' },
  { id: 'blue', label: 'Blue' },
  { id: 'cyan', label: 'Cyan' },
  { id: 'green', label: 'Green' },
  { id: 'amber', label: 'Amber' },
  { id: 'orange', label: 'Orange' },
  { id: 'red', label: 'Red' },
  { id: 'violet', label: 'Violet' },
  { id: 'magenta', label: 'Magenta' }
] as const

const BUTTON_COLORS: Readonly<Record<string, { foreground: string, background: string }>> = {
  white: { foreground: '#f1f5f7', background: '#273138' },
  blue: { foreground: '#55c7ff', background: '#123247' },
  cyan: { foreground: '#45e0dc', background: '#103638' },
  green: { foreground: '#62d88d', background: '#143522' },
  amber: { foreground: '#ffb84d', background: '#3b2b0d' },
  orange: { foreground: '#ff8a4c', background: '#3b2113' },
  red: { foreground: '#ff6258', background: '#3a1717' },
  violet: { foreground: '#a98cff', background: '#271f3d' },
  magenta: { foreground: '#f06bd8', background: '#3a1832' }
}

function buttonColorId(element?: ControlDeckGridCommandElement): string {
  if (!element) return 'default'
  return Object.entries(BUTTON_COLORS).find(([, value]) =>
    value.foreground === element.appearance.foregroundColor && value.background === element.appearance.backgroundColor
  )?.[0] ?? 'default'
}

type ToolButtonVariant = 'confirm' | 'delete' | 'neutral'

function ToolButton({ children, className, iconOnly = false, variant = 'neutral', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  iconOnly?: boolean
  variant?: ToolButtonVariant
}) {
  return <button {...props} className={[iconOnly && 'icon-action', 'tool-action', `tool-${variant}`, className].filter(Boolean).join(' ')}>{children}</button>
}

function DeleteIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 10v7m4-7v7" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.75" /></svg>
}

function CheckIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.75" /></svg>
}

function CloseIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.75" /></svg>
}
