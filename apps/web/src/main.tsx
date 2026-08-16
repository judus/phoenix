import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.js'
import { BrowserPhoenixRouter } from './platform/routing/browser-phoenix-router.js'
import 'deskplane/style.css'
import '@phoenix/ui/styles.css'
import './shell.css'

const root = document.getElementById('root')
if (!root) throw new Error('PHOENIX root element is missing.')
const router = new BrowserPhoenixRouter(window)

createRoot(root).render(
  <StrictMode>
    <App router={router} />
  </StrictMode>
)
