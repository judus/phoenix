# GalNet article archive

PHOENIX retains the GalNet articles it observes through the existing on-demand news refresh.
This is the evidence foundation for future GalNet intelligence, not an AI analysis service.

## Collection and identity

`FrontierGalnetSource` validates the official English JSON API feed at
[Frontier's CMS](https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article). Alongside the existing
article text, title, image and publication date it retains Frontier's article ID, `changed` date,
nullable `field_slug`, and an individual CMS source URL derived from the endpoint and article ID.
The source URL identifies the upstream article, not an immutable historical copy; retained text
is the evidence for older observations. No human-facing article URL is guessed from a slug.

Each successful expired/cold feed refresh records all returned articles before marking the feed
cache fresh. Concurrent callers share the fetch, archive write and cache write, while retaining
their individual response limits. A fresh cache hit does not refetch or manufacture an observation.
Collection uses the existing maximum of 100 latest articles; it does not crawl historical pages,
run on a timer, or promise to capture revisions that occur between observations.

## Storage and revisions

The server's `SqliteGalnetArticleArchive` owns two tables in the existing application database:
`galnet_article_revisions` stores evidence; `galnet_articles` points to the last observed revision
for each Frontier article ID. Migration 26 adds these tables without modifying the existing cache.
Existing cached articles are not backfilled with invented change dates or source metadata.

Stored documents are version 1. A SHA-256 digest of the schema-normalized document identifies
each distinct observed revision. Content and source-metadata changes produce a new revision;
identical fetches update only its last-observed timestamp, preserving the first observation.
Upstream change/publication dates and local observation dates remain distinct. A reversion can
point back to an already retained revision. Observation times are not part of the digest.

A batch updates revision evidence and current pointers in one SQLite transaction. Validation
or storage failure cannot leave a partially recorded batch. `getArticle(id)` reads the current
observation; `listRevisions(id)` reads retained distinct revisions, newest first observation first.
These are internal repository reads, not new HTTP endpoints or Copilot tools.

## Feed and failure semantics

The news API, response shape and UI remain unchanged: 15-minute latest-feed cache, per-request
limit, and the original fetch timestamp with explicit stale fallback if a refresh fails. The
archive is separate from this snapshot: an article leaving the latest feed is not deleted or
declared withdrawn, completed or irrelevant. A successful empty feed stays empty in the UI;
archived articles are not injected back into it. Source or archive failures do not advance cache
freshness. If cache persistence fails after a committed archive write, the evidence remains
retained and an identical retry deduplicates it.

This slice makes no AI calls, infers no stories/actions/locations and adds no Atlas markers,
personal participation tracking, archive UI or background worker. Future analysis needs its own
settings, budget and versioned extraction contract; it must preserve sources and distinguish
reported facts from interpretations. See issue #60 for that separate scope.
