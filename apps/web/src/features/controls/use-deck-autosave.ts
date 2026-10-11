import { useEffect, useRef, useState } from 'react'
import { PhoenixControlDeckConfigurationSchema, type PhoenixControlDeckConfiguration } from '@phoenix/contracts'

/** One revision-checked save at a time; typing during a save becomes the next snapshot. */
export function useDeckAutosave(configuration: PhoenixControlDeckConfiguration | undefined,
  onSave: (candidate: PhoenixControlDeckConfiguration) => Promise<PhoenixControlDeckConfiguration>) {
  const [draft, setDraft] = useState(configuration)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message: string, tone: 'warning' | 'danger' }>()
  const current = useRef(configuration)
  const dirty = useRef(false)
  const pending = useRef<Promise<boolean> | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveCallback = useRef(onSave)
  saveCallback.current = onSave

  useEffect(() => {
    if (!dirty.current && !pending.current && (!current.current || !configuration || configuration.revision >= current.current.revision)) {
      current.current = configuration
      setDraft(configuration)
    }
  }, [configuration])

  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined }

  const flush = (): Promise<boolean> => {
    clearTimer()
    if (pending.current) return pending.current
    if (!dirty.current || !current.current) return Promise.resolve(true)
    setSaving(true)
    const work = async () => {
      try {
        while (dirty.current && current.current) {
          const candidate = current.current
          const parsed = PhoenixControlDeckConfigurationSchema.safeParse({ ...candidate,
            groups: candidate.groups?.map(group => ({ ...group, name: group.name.trim() })),
            decks: candidate.decks.map(deck => ({ ...deck, name: deck.name.trim() })) })
          if (!parsed.success) {
            setError({ message: parsed.error.issues[0]?.message ?? 'Invalid deck configuration.', tone: 'warning' })
            return false
          }
          const saved = await saveCallback.current(parsed.data)
          if (current.current === candidate) {
            current.current = saved
            dirty.current = false
          } else {
            current.current = { ...current.current!, revision: saved.revision }
          }
          setDraft(current.current)
        }
        setError(undefined)
        return true
      } catch (cause) {
        setError({ message: cause instanceof Error ? cause.message : 'Unable to save decks.', tone: 'danger' })
        return false
      }
    }
    pending.current = work().finally(() => { pending.current = undefined; setSaving(false) })
    return pending.current
  }

  const change = (candidate: PhoenixControlDeckConfiguration, typing = false) => {
    current.current = candidate
    dirty.current = true
    setDraft(candidate)
    setError(undefined)
    clearTimer()
    if (typing) timer.current = setTimeout(() => void flush(), 400)
    else void flush()
  }

  // Leaving the manager also commits the last keystrokes, rather than dropping the timer.
  useEffect(() => () => { void flush() }, [])

  return { draft, saving, error, setError, change, flush }
}
