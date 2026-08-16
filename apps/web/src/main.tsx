import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.js'
import 'deskplane/style.css'
import '@phoenix/ui/styles.css'
import './shell.css'

const root = document.getElementById('root')
if (!root) throw new Error('PHOENIX root element is missing.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
