import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.js'
import { createPhoenixApplication } from './bootstrap/create-application.js'
import 'deskplane/style.css'
import '@jdu/control-deck-ui/styles.css'
import '@phoenix/ui/styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('PHOENIX root element is missing.')
const application = createPhoenixApplication(window)

createRoot(root).render(
  <StrictMode>
    <App application={application} />
  </StrictMode>
)
