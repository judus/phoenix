import { useMemo, useState, type FormEvent } from 'react'
import { commandTargetKey, type CommandDescriptor, type NumpadShortcut } from '@phoenix/contracts'
import { Button, DataTable, Field, Form, FormActions, FormGrid, Select, Status, TextInput } from '@phoenix/ui'

export function NumpadShortcutEditor({ commands, onSave, shortcuts }: { commands: CommandDescriptor[], shortcuts: NumpadShortcut[], onSave(shortcuts: NumpadShortcut[]): Promise<boolean> }) {
  const available = useMemo(() => [...commands].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)), [commands])
  const [selector, setSelector] = useState('')
  const [targetKey, setTargetKey] = useState(available[0] ? commandTargetKey(available[0].target) : '')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const command = available.find(candidate => commandTargetKey(candidate.target) === targetKey)
    if (!/^\d{1,3}$/u.test(selector)) return setError('Choose a one to three digit shortcut.')
    if (shortcuts.some(shortcut => shortcut.selector === selector)) return setError(`Shortcut 09${selector} is already assigned.`)
    if (!command) return setError('Choose a command target.')
    setSaving(true)
    const shortcut: NumpadShortcut = { id: `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, selector, target: command.target, ...(label.trim() ? { label: label.trim() } : {}) }
    try { if (await onSave([...shortcuts, shortcut])) { setSelector(''); setLabel(''); setError(undefined) } } finally { setSaving(false) }
  }
  const remove = async (id: string) => { setSaving(true); try { await onSave(shortcuts.filter(shortcut => shortcut.id !== id)) } finally { setSaving(false) } }

  return <div className="numpad-shortcuts">
    <Form onSubmit={event => void submit(event)}>
      <FormGrid>
        <Field htmlFor="shortcut-address" label="Address" hint="Appended below 09"><TextInput inputMode="numeric" maxLength={3} value={selector} onChange={event => setSelector(event.target.value.replace(/\D/gu, ''))} /></Field>
        <Field htmlFor="shortcut-command" label="Command"><Select value={targetKey} onChange={event => setTargetKey(event.target.value)}>{available.map(command => <option key={command.id} value={commandTargetKey(command.target)}>{command.category} · {command.label}</option>)}</Select></Field>
        <Field htmlFor="shortcut-label" label="Optional label"><TextInput maxLength={80} value={label} onChange={event => setLabel(event.target.value)} placeholder="Use command label" /></Field>
      </FormGrid>
      <FormActions message={error && <span className="text-danger">{error}</span>}><Button busy={saving} disabled={available.length === 0} variant="primary" type="submit">Add shortcut</Button></FormActions>
    </Form>
    {shortcuts.length === 0 ? <Status tone="muted">No custom shortcuts configured.</Status> : <DataTable density="compact" label="Custom numpad shortcuts" minimum="wide" scheme="surface"><thead><tr><th>Address</th><th>Label</th><th>Command</th><th>Action</th></tr></thead><tbody>{shortcuts.map(shortcut => { const command = commands.find(candidate => commandTargetKey(candidate.target) === commandTargetKey(shortcut.target)); return <tr key={shortcut.id}><th scope="row">09{shortcut.selector}</th><td>{shortcut.label ?? command?.label ?? 'Unavailable command'}</td><td>{command ? `${command.category} · ${command.kind}` : commandTargetKey(shortcut.target)}</td><td><Button disabled={saving} variant="danger" onClick={() => void remove(shortcut.id)}>Remove</Button></td></tr> })}</tbody></DataTable>}
  </div>
}
