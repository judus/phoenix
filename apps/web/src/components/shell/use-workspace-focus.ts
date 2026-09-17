import { useEffect, useState } from 'react'

export interface WorkspaceFocus {
  active: boolean
  setActive(active: boolean): void
  toggle(): void
}

export function useWorkspaceFocus(): WorkspaceFocus {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!active || typeof globalThis.addEventListener !== 'function') return
    const exit = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setActive(false)
    }
    globalThis.addEventListener('keydown', exit)
    return () => globalThis.removeEventListener('keydown', exit)
  }, [active])

  return {
    active,
    setActive,
    toggle: () => setActive(current => !current)
  }
}
