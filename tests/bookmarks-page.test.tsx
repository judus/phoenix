import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { GalaxyBookmark } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { BookmarksPage } from '../apps/web/src/features/galaxy/bookmarks-page.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const bookmarks: GalaxyBookmark[] = [
  {
    createdAt: '2026-09-11T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    note: 'Return for biological signals.',
    tags: ['Exploration', 'Biology'],
    target: { bodyName: 'Smoje TO-Z d13-40 3 A', kind: 'body', systemName: 'Smoje TO-Z d13-40' },
    updatedAt: '2026-09-11T10:00:00.000Z'
  },
  {
    createdAt: '2026-09-11T09:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000002',
    note: 'Visit Voyager.',
    tags: ['Historic'],
    target: { kind: 'system', systemName: 'Sol' },
    updatedAt: '2026-09-11T09:00:00.000Z'
  }
]

test('bookmark list searches notes and filters reusable tags', async () => {
  const api = { getGalaxyBookmarks: vi.fn().mockResolvedValue({ bookmarks }) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<BookmarksPage
      api={api}
      onNavigate={() => {}}
      route={{ kind: 'information', section: 'galaxy', view: 'bookmarks' }}
    />)
  })

  expect(renderer.root.findAllByType('a').map(node => node.props.href)).toContain('#/galaxy/system?name=Sol')
  await act(async () => renderer.root.findByProps({ id: 'bookmark-search' }).props.onChange({ target: { value: 'voyager' } }))
  expect(renderer.root.findAllByType('strong').map(node => node.children.join(''))).toContain('Sol')
  expect(renderer.root.findAllByType('strong').map(node => node.children.join(''))).not.toContain('Smoje TO-Z d13-40 3 A')

  await act(async () => renderer.root.findByProps({ id: 'bookmark-search' }).props.onChange({ target: { value: '' } }))
  const biology = renderer.root.findAllByType('input').find(node => node.props.type === 'checkbox' && node.props.checked === false)
  expect(biology).toBeDefined()
  await act(async () => biology!.props.onChange())
  expect(renderer.root.findAllByType('strong').map(node => node.children.join(''))).toContain('Smoje TO-Z d13-40 3 A')
  expect(renderer.root.findAllByType('strong').map(node => node.children.join(''))).not.toContain('Sol')

  await act(async () => renderer.unmount())
})

test('bookmark editor saves notes and comma-separated tags for its target', async () => {
  const saveGalaxyBookmark = vi.fn().mockResolvedValue(bookmarks[0])
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  const api = {
    getGalaxyBookmarks: vi.fn().mockResolvedValue({ bookmarks: [] }),
    saveGalaxyBookmark
  } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<BookmarksPage
      api={api}
      onNavigate={onNavigate}
      route={{ bodyName: 'Earth', kind: 'information', section: 'galaxy', systemName: 'Sol', view: 'bookmarks' }}
    />)
  })
  await act(async () => renderer.root.findByProps({ id: 'bookmark-note' }).props.onChange({ target: { value: 'Home world' } }))
  await act(async () => renderer.root.findByProps({ id: 'bookmark-editor-tags' }).props.onChange({ target: { value: 'Home, Historic' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))

  expect(saveGalaxyBookmark).toHaveBeenCalledWith({
    note: 'Home world',
    tags: ['Home', 'Historic'],
    target: { bodyName: 'Earth', kind: 'body', systemName: 'Sol' }
  }, undefined)
  expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'bookmarks' })

  await act(async () => renderer.unmount())
})
