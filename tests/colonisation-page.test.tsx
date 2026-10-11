import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ColonisationPage } from '../apps/web/src/features/activities/colonisation-page.js'
import { act } from 'react-test-renderer'
import { renderWithAct } from './support/render-with-act.js'
import { notificationText } from './support/notifications.js'

test('empty colony history is not an empty ownership manifest and an initial failure does not keep loading', async () => {
  const markup = renderToStaticMarkup(<ColonisationPage controller={{ status: 'ready', colonisation: { claims: [], depots: [], contributions: [], retainedContributions: 0 } }} />)
  expect(markup).toContain('Work in progress')
  expect(markup).toContain('No construction depot observed')
  expect(markup).toContain('not an ownership manifest')
  const failed = renderToStaticMarkup(<ColonisationPage controller={{ status: 'error', error: 'Offline' }} />)
  expect(failed).not.toContain('Offline')
  expect(failed).not.toContain('Loading construction')
  const renderer = await renderWithAct(<ColonisationPage controller={{ status: 'error', error: 'Offline' }} />)
  expect(notificationText()).toContain('Offline')
  await act(async () => renderer.unmount())
})
