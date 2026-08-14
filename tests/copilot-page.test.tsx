import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PhoenixApiClient } from '../apps/web/src/api/phoenix-api-client.js'
import { CopilotVoiceProvider } from '../apps/web/src/features/copilot/copilot-voice-provider.js'
import { CopilotPage } from '../apps/web/src/pages/copilot-page.js'

test('the Copilot chat keeps Realtime access compact and conversation-first', () => {
  const markup = renderToStaticMarkup(
    <CopilotVoiceProvider>
      <CopilotPage api={new PhoenixApiClient()} />
    </CopilotVoiceProvider>
  )

  expect(markup).toContain('Copilot profile')
  expect(markup).toContain('aria-label="Connect realtime"')
  expect(markup).not.toContain('Voice channel')
  expect(markup).not.toContain('System default')
  expect(markup).not.toContain('Agent profile')
  expect(markup).not.toContain('Realtime migration pending')
})
