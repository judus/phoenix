import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import { CopilotVoiceProvider } from '../apps/web/src/features/copilot/copilot-voice-provider.js'
import { CopilotPage } from '../apps/web/src/pages/copilot-page.js'

test('the Copilot page exposes an enabled route-persistent Realtime control surface', () => {
  const markup = renderToStaticMarkup(
    <CopilotVoiceProvider>
      <CopilotPage api={new PhoenixApiClient()} />
    </CopilotVoiceProvider>
  )

  expect(markup).toContain('Voice channel')
  expect(markup).toContain('Connect realtime')
  expect(markup).toContain('System default')
  expect(markup).not.toContain('Realtime migration pending')
  expect(markup).not.toContain('disabled=""&gt;Connect realtime')
})
