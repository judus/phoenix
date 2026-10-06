import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { Tabs } from '../packages/ui/src/components/tabs.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('route tabs retain link navigation and current-page semantics', async () => {
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(<Tabs current="profile" label="Sections" items={[
    { id: 'profile', label: 'Profile', href: '#/profile' },
    { id: 'permissions', label: 'Permissions', href: '#/permissions', disabled: true }
  ]} />) })
  try {
    const link = renderer.root.findByType('a')
    expect(link.props.href).toBe('#/profile')
    expect(link.props['aria-current']).toBe('page')
    expect(renderer.root.findAllByType('button')).toHaveLength(0)
    expect(renderer.root.findByType('span').props['aria-disabled']).toBe('true')
  } finally { await act(async () => renderer.unmount()) }
})

test('panel tabs select with clicks and keyboard, wrap and skip disabled panels', async () => {
  let renderer!: ReactTestRenderer
  const select = vi.fn(), focus = vi.fn()
  const getElementById = vi.fn(() => ({ focus }))
  await act(async () => { renderer = create(<Tabs current="profile" label="Editor" onSelect={select} items={[
    { id: 'profile', label: 'Profile', panelId: 'profile-panel' },
    { id: 'disabled', label: 'Unavailable', panelId: 'disabled-panel', disabled: true },
    { id: 'permissions', label: 'Permissions', panelId: 'permissions-panel' }
  ]} />) })
  try {
    expect(renderer.root.findByType('ul').props.role).toBe('tablist')
    const [profile, disabled, permissions] = renderer.root.findAllByType('button')
    expect(profile!.props).toMatchObject({ role: 'tab', 'aria-selected': true, 'aria-controls': 'profile-panel', tabIndex: 0, type: 'button' })
    expect(disabled!.props.disabled).toBe(true)
    expect(permissions!.props.tabIndex).toBe(-1)
    permissions!.props.onClick()
    expect(select).toHaveBeenLastCalledWith('permissions')
    for (const [key, target] of [['ArrowRight', 'permissions'], ['ArrowLeft', 'permissions'], ['Home', 'profile'], ['End', 'permissions']]) {
      const preventDefault = vi.fn()
      profile!.props.onKeyDown({ key, preventDefault, currentTarget: { ownerDocument: { getElementById } } })
      expect(preventDefault).toHaveBeenCalledOnce()
      expect(select).toHaveBeenLastCalledWith(target)
      expect(getElementById).toHaveBeenLastCalledWith(target)
    }
    const preventDefault = vi.fn(), calls = select.mock.calls.length
    profile!.props.onKeyDown({ key: 'Tab', preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(select).toHaveBeenCalledTimes(calls)
    expect(focus).toHaveBeenCalledTimes(4)
  } finally { await act(async () => renderer.unmount()) }
})
