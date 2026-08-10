import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.js'
import { CopilotVoiceProvider } from './features/copilot/copilot-voice-provider.js'
import './styles/index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/primitives/app-shell.css'
import './styles/primitives/navigation.css'
import './styles/primitives/page.css'
import './styles/patterns/status-list.css'
import './styles/patterns/control-grid.css'
import './styles/patterns/copilot.css'
import './styles/utilities.css'

const root = document.getElementById('root')
if (!root) throw new Error('PHOENIX root element is missing.')

createRoot(root).render(
  <StrictMode>
    <CopilotVoiceProvider>
      <App />
    </CopilotVoiceProvider>
  </StrictMode>
)
