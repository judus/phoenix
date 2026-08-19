import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ControlDeckApi } from './api.js'
import { ControlDeckApp } from './control-deck-app.js'
import '@jdu/control-deck-ui/styles.css'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Control Deck root element is missing.')
createRoot(root).render(<StrictMode><ControlDeckApp api={new ControlDeckApi()} /></StrictMode>)
