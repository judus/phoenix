import type { GalnetArticle } from '@phoenix/contracts'
export function GalnetArticleReader({ article }: {
  article: GalnetArticle
}) {
  return <article className="galnet-reader" tabIndex={0}>
    <header><h2>{article.title}</h2></header>
    <div className="article-body">
      <div className="article-text">{article.body.split(/\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </div>
  </article>
}
