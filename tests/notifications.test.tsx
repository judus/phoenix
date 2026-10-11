import { StrictMode, type ReactElement } from 'react'
import { act } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test } from 'vitest'
import { toast } from 'sonner'
import { Notification } from '@phoenix/ui'
import { renderWithAct } from './support/render-with-act.js'
import { activeNotifications, notificationMarkup, notificationText } from './support/notifications.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
afterEach(() => toast.dismiss())

test('errors use the shared red alert, do not reserve inline space and stay dismissed during repeated refreshes', async () => {
  const page = () => <Notification message="Synthetic request failed." />
  const renderer = await renderWithAct(page())
  try {
    expect(renderer.toJSON()).toBeNull()
    expect(notificationText()).toBe('Synthetic request failed.')
    expect(notificationMarkup()).toContain('toast danger notification')
    expect(notificationMarkup()).toContain('role="alert"')
    const notice = activeNotifications()[0]!
    expect(notice.duration).toBe(Infinity)
    const jsx = notice.jsx as ReactElement<{ onDismiss(): void }>
    await act(async () => jsx.props.onDismiss())
    expect(toast.getToasts()).toHaveLength(0)
    await act(async () => renderer.update(page()))
    expect(toast.getToasts()).toHaveLength(0)
    await act(async () => renderer.update(<Notification />))
    await act(async () => renderer.update(page()))
    expect(notificationText()).toBe('Synthetic request failed.')
  } finally { await act(async () => renderer.unmount()) }
})

test('advisories are orange live statuses; details and diagnostic links are retained', async () => {
  const renderer = await renderWithAct(<Notification tone="warning" message="Current system unavailable.">
    <a href="#/settings/help">Setup help</a>
  </Notification>)
  try {
    expect(notificationMarkup()).toContain('toast warning notification')
    expect(notificationMarkup()).toContain('role="status"')
    expect(notificationMarkup()).toContain('href="#/settings/help"')
    expect(notificationMarkup()).not.toContain('role="alert"')
  } finally { await act(async () => renderer.unmount()) }
})

test('Strict Mode and new array identities do not duplicate feedback; changed feedback replaces its owner', async () => {
  const render = (messages: string[]) => <StrictMode><Notification messages={messages} /></StrictMode>
  const renderer = await renderWithAct(render(['First failure', 'First failure']))
  try {
    expect(toast.getToasts()).toHaveLength(1)
    expect(notificationText()).toBe('First failure')
    await act(async () => renderer.update(render(['First failure', 'First failure'])))
    expect(toast.getToasts()).toHaveLength(1)
    await act(async () => renderer.update(render(['Different failure'])))
    expect(toast.getToasts()).toHaveLength(1)
    expect(notificationText()).toBe('Different failure')
  } finally { await act(async () => renderer.unmount()) }
  expect(toast.getToasts()).toHaveLength(0)
})

test('clearing one notification owner does not clear another page operation', async () => {
  const render = (first?: string) => <><Notification message={first} /><Notification message="Other operation" /></>
  const renderer = await renderWithAct(render('First operation'))
  try {
    expect(toast.getToasts()).toHaveLength(2)
    await act(async () => renderer.update(render()))
    expect(notificationText()).toBe('Other operation')
  } finally { await act(async () => renderer.unmount()) }
})
