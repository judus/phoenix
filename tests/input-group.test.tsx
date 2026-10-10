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
