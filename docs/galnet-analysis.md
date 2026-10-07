# Manual GalNet analysis

Comms → GalNet offers an optional **Analyse article** action below the article text. Opening
the page or selecting an article only reads a saved report; it never invokes AI. Analysis uses
the active OpenAI key from PHOENIX Settings and the existing `PHOENIX_OPENAI_MODEL` model
selection (same default as text Copilot). The action discloses API-credit usage. It does not use
a Copilot profile, conversation, permissions, game state or tools.

## Evidence and Community Goals

The application supplies the exact archived article revision and the existing structured
Community Goals service snapshot. A failed CG fetch without a saved snapshot stops analysis;
it is not converted to an empty campaign list. Stale CG snapshots remain labelled with their
original fetch time. AI reports retain that entire snapshot, not a manufactured live status.

The report separates facts, interpretation, mentioned entities and possible activities. Every
supporting quote must be an exact substring of the article title or body. Related campaign
activities reference authoritative CG IDs and appear under **Related Community Goals**, once
per goal; progress and destination are read from the saved structured snapshot. Explicit versus
possible linkage remains an AI assessment, not a verified gameplay relationship. Unlinked
activities appear as separate investigation leads. The prompt forbids repeating a linked or
possibly linked CG as an independent lead; no report creates any goals or Atlas pins.

Schema validation and ID/quote checks reject malformed evidence, unknown or duplicate CG
references and inconsistent relationships before persistence. These checks are not proof that
the interpretation is true or that an unlinked activity is genuinely separate: manual quality
review remains necessary. Absence from the current CG snapshot does not prove an old campaign
never existed. Historical CG reconciliation and multi-article story merging are separate work.

The report shows its analysis time, model, source link, CG snapshot freshness and known input/
output token counts (unknown counts remain unknown). A changed archived article is flagged.
Reports are dated evidence, not live campaign availability, personal eligibility or rewards.

## Requests, persistence and limits

The narrow adapter uses the installed `@jdu/llm-client` low-level `ModelClient` and OpenAI provider,
with [strict structured output](https://developers.openai.com/api/docs/guides/structured-outputs).
No hosted tools, MCP, online research, conversation history or automatic repair/retry are enabled.
Provider response storage is disabled. Article/CG contents are untrusted input, not instructions.

Each explicit action permits one request: at most 60,000 serialized input characters, 4,000 output
tokens and a 90-second inference timeout. One article job runs at a time per installation;
simultaneous requests for that article share the job. No fixed monetary estimate is invented.
**Update analysis** reuses a successful saved report when the article revision, model, extractor
version and CG contents match. Snapshot timestamps/cache-state alone do not cause another paid
request. Changed evidence can incur a new request, but only after another explicit press.

Migration 27 adds `galnet_analyses` to the existing SQLite database. Successful version-1 reports
are keyed by an SHA-256 evidence/configuration digest; prior reports remain readable across
restart or key removal. Read endpoints do not perform inference. Failed, refused, truncated or
invalid output is not saved as a successful report; an older valid report remains visible.
Credits may still have been consumed if a provider request fails validation or persistence.

Navigating away cancels the browser request, not the shared installation job; a valid result
can finish and be saved for a later visit. Application shutdown aborts inference and waits before
closing SQLite; late/cancelled output is not persisted. Failures are visible in the article panel,
not silently retried. This is a manual opt-in action, not a new automatically enabled AI service.

## Remaining scope

No background analysis, web enrichment, location resolution, Atlas publishing, new Copilot tool,
personal CG tracking or story lifecycle reconciliation is included. Those require separate work,
including settings and budgets before any automatic inference is introduced. The non-AI CG page
and Atlas remain independent. See #60 and [the article archive](galnet-archive.md).
