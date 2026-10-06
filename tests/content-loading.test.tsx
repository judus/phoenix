import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import { Loading } from '@phoenix/ui'
import { EquipmentPageLayout } from '../apps/web/src/features/equipment/equipment-page-layout.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('loading is announced while its decorative Phoenix remains hidden from assistive technology', () => {
  const markup = renderToStaticMarkup(<Loading>Loading equipment…</Loading>)
  expect(markup).toContain('role="status"')
  expect(markup).toContain('aria-live="polite"')
  expect(markup).toContain('aria-hidden="true"')
  expect(markup).toContain('Loading equipment…')
})

test('content replaces loading immediately and errors never show the animation', async () => {
  const renderer = await renderWithAct(<EquipmentPageLayout busy loadingMessage="Loading equipment…" title="Gear" />)
  expect(renderer.root.findAllByType(Loading)).toHaveLength(1)
  expect(renderer.root.findByType('h1').children).toEqual(['Gear'])
  await act(async () => renderer.update(<EquipmentPageLayout title="Gear"><p>Equipment ready</p></EquipmentPageLayout>))
  expect(renderer.root.findAllByType(Loading)).toHaveLength(0)
  expect(renderer.root.findByType('p').children).toEqual(['Equipment ready'])
  await act(async () => renderer.update(<EquipmentPageLayout title="Gear" error="Equipment unavailable" loadingMessage="Loading equipment…" />))
  expect(renderer.root.findAllByType(Loading)).toHaveLength(0)
  expect(JSON.stringify(renderer.toJSON())).toContain('Equipment unavailable')
  await act(async () => renderer.unmount())
})
