import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  commandTargetKey,
  type CommandDescriptor,
  type NumpadShortcut
} from '@phoenix/contracts'

interface NumpadShortcutEditorProps {
  commands: CommandDescriptor[]
  shortcuts: NumpadShortcut[]
  onSave: (shortcuts: NumpadShortcut[]) => Promise<boolean>
}

export function NumpadShortcutEditor ({ commands, onSave, shortcuts }: NumpadShortcutEditorProps) {
  const available = useMemo(() => [...commands]
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label)), [commands])
  const [selector, setSelector] = useState('')
  const [targetKey, setTargetKey] = useState(available[0] ? commandTargetKey(available[0].target) : '')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!available.some(command => commandTargetKey(command.target) === targetKey)) {
      setTargetKey(available[0] ? commandTargetKey(available[0].target) : '')
    }
  }, [available, targetKey])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const command = available.find(candidate => commandTargetKey(candidate.target) === targetKey)
    if (!/^\d{1,3}$/u.test(selector)) return setError('Choose a one to three digit shortcut.')
    if (shortcuts.some(shortcut => shortcut.selector === selector)) return setError(`Shortcut 09${selector} is already assigned.`)
    if (!command) return setError('Choose a command target.')
    const shortcut: NumpadShortcut = {
      id: shortcutId(),
      selector,
      target: command.target,
      ...(label.trim() ? { label: label.trim() } : {})
    }
    setSaving(true)
    try {
      if (!await onSave([...shortcuts, shortcut])) return
      setSelector('')
      setLabel('')
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save shortcut.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string): Promise<void> => {
    setSaving(true)
    try {
      if (!await onSave(shortcuts.filter(shortcut => shortcut.id !== id))) return
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove shortcut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="numpad-shortcuts">
      <form className="numpad-shortcuts__form" onSubmit={event => void submit(event)}>
        <label>
          Address
          <span className="numpad-shortcuts__address"><strong>09</strong><input inputMode="numeric" maxLength={3} value={selector} onChange={event => setSelector(event.target.value.replace(/\D/gu, ''))} /></span>
        </label>
        <label>
          Command
          <select value={targetKey} onChange={event => setTargetKey(event.target.value)}>
            {available.map(command => <option key={command.id} value={commandTargetKey(command.target)}>{command.category} · {command.label}</option>)}
          </select>
        </label>
        <label>
          Optional label
          <input maxLength={80} value={label} onChange={event => setLabel(event.target.value)} placeholder="Use command label" />
        </label>
        <button disabled={saving || available.length === 0} type="submit">Add shortcut</button>
      </form>
      {error && <p className="numpad-shortcuts__error">{error}</p>}
      <div className="numpad-shortcuts__list">
        {shortcuts.length === 0 && <p>No custom shortcuts configured.</p>}
        {shortcuts.map(shortcut => {
          const command = commands.find(candidate => commandTargetKey(candidate.target) === commandTargetKey(shortcut.target))
          return (
            <article key={shortcut.id}>
              <strong>09{shortcut.selector}</strong>
              <span>{shortcut.label ?? command?.label ?? 'Unavailable command'}</span>
              <small>{command ? `${command.category} · ${command.kind}` : commandTargetKey(shortcut.target)}</small>
              <button disabled={saving} type="button" onClick={() => void remove(shortcut.id)}>Remove</button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function shortcutId (): string {
  return `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
