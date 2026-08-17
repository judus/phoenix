import { useEffect, useState } from 'react'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'
import { getNumpadActivationEnabled, setNumpadActivationEnabled, subscribeToNumpadActivation } from './numpad-activation-state.js'
import { armNumpadRoute } from './numpad-route-session.js'

export function NumpadActivation({ api, router }: { api: PhoenixApi, router: PhoenixRouter }) {
  const [enabled, setEnabled] = useState(getNumpadActivationEnabled)
  useEffect(() => subscribeToNumpadActivation(setEnabled), [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const abort = new AbortController()
    void api.getModuleSettings(abort.signal).then(settings => setNumpadActivationEnabled(settings.numpadCommands.enabled)).catch(() => {})
    const activate = (event: KeyboardEvent) => {
      if (!enabled || event.code !== 'Numpad0' || editable(event.target) || router.getSnapshot().kind === 'numpad') return
      event.preventDefault()
      armNumpadRoute(window.location.hash)
      router.push({ kind: 'numpad', view: 'navigator' })
    }
    window.addEventListener('keydown', activate)
    return () => { abort.abort(); window.removeEventListener('keydown', activate) }
  }, [api, enabled, router])
  return null
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}
