import { useCallback, useSyncExternalStore } from 'react'

export interface FullscreenState {
  active: boolean
  supported: boolean
  toggle(): Promise<void>
}

export function useFullscreen(
  documentObject: Document | undefined = typeof document === 'undefined' ? undefined : document
): FullscreenState {
  const subscribe = useCallback((listener: () => void) => {
    if (!documentObject) return () => undefined
    documentObject.addEventListener('fullscreenchange', listener)
    return () => documentObject.removeEventListener('fullscreenchange', listener)
  }, [documentObject])
  const getSnapshot = useCallback(() => documentObject?.fullscreenElement != null, [documentObject])
  const active = useSyncExternalStore(subscribe, getSnapshot, () => false)
  const supported = documentObject?.fullscreenEnabled === true

  return {
    active,
    supported,
    async toggle() {
      if (!supported) return
      if (!documentObject) return
      if (documentObject.fullscreenElement) {
        await documentObject.exitFullscreen()
        return
      }
      await documentObject.documentElement.requestFullscreen({ navigationUI: 'hide' })
    }
  }
}
