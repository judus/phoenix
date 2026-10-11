import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { IconButton, InputGroup, Select, TextInput } from '@phoenix/ui'
import { renderWithAct } from './support/render-with-act.js'

test('input groups attach an explicit label and preserve native input and submit semantics', async () => {
  const change = vi.fn()
  const renderer = await renderWithAct(<InputGroup label="System" htmlFor="system"
    action={<IconButton label="Load system" type="submit">→</IconButton>}>
    <TextInput id="system" value="Sol" onChange={change} />
  </InputGroup>)
  try {
    expect(renderer.root.findByType('label').props.htmlFor).toBe('system')
    expect(renderer.root.findByType('input').props.id).toBe('system')
    expect(renderer.root.findByType('button').props.type).toBe('submit')
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Colonia' } }))
    expect(change).toHaveBeenCalledWith({ target: { value: 'Colonia' } })
    await act(async () => renderer.update(<InputGroup label="Layout" htmlFor="layout">
      <Select id="layout" disabled value="locked" onChange={change}><option value="locked">Locked</option></Select>
    </InputGroup>))
    expect(renderer.root.findByType('label').props.htmlFor).toBe('layout')
    expect(renderer.root.findByType('select').props.disabled).toBe(true)
  } finally { await act(async () => renderer.unmount()) }
})

test('input groups accept icon content in the existing label slot', async () => {
  const pointerDown = vi.fn()
  const renderer = await renderWithAct(<InputGroup className="filled" htmlFor="deck-name" label={<span role="button" tabIndex={0} aria-label="Reorder deck" onPointerDown={pointerDown}>Grip</span>}>
    <TextInput id="deck-name" aria-label="Deck name" defaultValue="Ship" />
  </InputGroup>)
  try {
    expect(renderer.root.findByType('label').props.htmlFor).toBe('deck-name')
    expect(renderer.root.findByType('input').props['aria-label']).toBe('Deck name')
    await act(async () => renderer.root.findByProps({ role: 'button' }).props.onPointerDown({ pointerId: 1 }))
    expect(pointerDown).toHaveBeenCalledWith({ pointerId: 1 })
  } finally { await act(async () => renderer.unmount()) }
})
