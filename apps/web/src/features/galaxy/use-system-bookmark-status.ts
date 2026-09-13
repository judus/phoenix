import { useEffect, useState } from 'react'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function useSystemBookmarkStatus (api: PhoenixApi, systemName: string): boolean {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const normalizedSystemName = systemName.trim().toLocaleLowerCase()
    setBookmarked(false)
    void api.getGalaxyBookmarks(controller.signal)
      .then(response => {
        if (controller.signal.aborted) return
        setBookmarked(response.bookmarks.some(bookmark => (
          bookmark.target.kind === 'system'
          && bookmark.target.systemName.trim().toLocaleLowerCase() === normalizedSystemName
        )))
      })
      .catch(() => {
        if (!controller.signal.aborted) setBookmarked(false)
      })
    return () => controller.abort()
  }, [api, systemName])

  return bookmarked
}
