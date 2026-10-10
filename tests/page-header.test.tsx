import { expect, test } from 'vitest'
import { Button, ControlContext, PageHeader } from '@phoenix/ui'
import { act } from 'react-test-renderer'
import { renderWithAct } from './support/render-with-act.js'

test('page header groups status and actions without imposing compact control sizing', async () => {
  const renderer = await renderWithAct(<PageHeader title="Ship catalogue" status="Updated today" actions={<Button>Show table</Button>} />)
  const tools = renderer.root.findByProps({ className: 'tools' })
  expect(tools.findByProps({ className: 'page-status' }).children).toEqual(['Updated today'])
  const controls = tools.findByType(ControlContext)
  expect(controls.props.context).toBe('toolbar')
  expect(controls.props.density).toBeUndefined()
  expect(controls.findByType(Button).props.size).toBeUndefined()
  await act(async () => renderer.unmount())
})

test('page header supports status alone without an empty action row', async () => {
  const renderer = await renderWithAct(<PageHeader title="Commander" status="Updated today" />)
  expect(renderer.root.findByProps({ className: 'tools' }).findAllByType(ControlContext)).toHaveLength(0)
  await act(async () => renderer.unmount())
})

test('page header without status or actions does not reserve toolbox space', async () => {
  const renderer = await renderWithAct(<PageHeader title="Blueprints" />)
  expect(renderer.root.findAllByProps({ className: 'tools' })).toHaveLength(0)
  await act(async () => renderer.unmount())
})
