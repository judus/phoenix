import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (!root) throw new Error('PHOENIX root element is missing.')

createRoot(root).render(
  <StrictMode>
    <></>
  </StrictMode>
)
