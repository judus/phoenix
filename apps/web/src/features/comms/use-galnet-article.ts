import { useEffect, useState } from 'react'
import type { GalnetArchivedArticle } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function useGalnetArticle(api: Pick<PhoenixApi, 'getGalnetArchivedArticle'>, articleId: string) {
  const [article, setArticle] = useState<GalnetArchivedArticle>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    void api.getGalnetArchivedArticle(articleId, controller.signal).then(result => {
      if (!controller.signal.aborted) setArticle(result)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Article unavailable.') })
    return () => controller.abort()
  }, [api, articleId])
  return { article, error }
}
