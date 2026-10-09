import { useEffect, useRef, useState } from 'react'
import type { GalnetBackgroundStatus } from '@phoenix/contracts'
import type { PhoenixApi } from '../application/api/phoenix-api.js'

export type GalnetBackgroundApi = Pick<PhoenixApi, 'getGalnetBackground' | 'saveGalnetBackground' | 'catchUpGalnet'>

export function useGalnetBackground(api: GalnetBackgroundApi) {
  const [status, setStatus] = useState<GalnetBackgroundStatus>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const lifetime = useRef<{ controller: AbortController, revision: number, saving: boolean }>(undefined)
  useEffect(() => {
    const owner = { controller: new AbortController(), revision: 0, saving: false }
    lifetime.current = owner
    setStatus(undefined)
    setError(undefined)
    setPending(false)
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      const revision = owner.revision
      if (!owner.saving) {
        try {
          const next = await api.getGalnetBackground(owner.controller.signal)
          if (!owner.controller.signal.aborted && owner.revision === revision) { setStatus(next); setError(undefined) }
        } catch (cause) {
          if (!owner.controller.signal.aborted && owner.revision === revision) setError(message(cause))
        }
      }
      if (!owner.controller.signal.aborted) timer = setTimeout(() => void refresh(), 5_000)
    }
    void refresh()
    return () => { owner.controller.abort(); clearTimeout(timer) }
  }, [api])

  const change = async (action: (signal: AbortSignal) => Promise<GalnetBackgroundStatus>) => {
    const owner = lifetime.current
    if (!owner || owner.controller.signal.aborted || owner.saving) return
    owner.saving = true
    owner.revision++
    setPending(true)
    setError(undefined)
    try {
      const next = await action(owner.controller.signal)
      if (!owner.controller.signal.aborted) setStatus(next)
    } catch (cause) {
      if (!owner.controller.signal.aborted) setError(message(cause))
    } finally {
      owner.saving = false
      if (!owner.controller.signal.aborted) setPending(false)
    }
  }
  return { status, error, pending, change }
}

function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'GalNet intelligence unavailable.' }
