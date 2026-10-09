# GalNet analysis

Comms → GalNet offers an optional **Analyse article** action below the article text. Opening
the page or selecting an article only reads a saved report; it never invokes AI itself. Analysis uses
the active OpenAI key from PHOENIX Settings and the existing `PHOENIX_OPENAI_MODEL` model
selection (same default as text Copilot). The action discloses API-credit usage. It does not use
a Copilot profile, conversation, permissions, game state or tools.

## Evidence and Community Goals

The application supplies the exact archived article revision and the existing structured
Community Goals service snapshot. A failed CG fetch without a saved snapshot stops analysis;
it is not converted to an empty campaign list. Stale CG snapshots remain labelled with their
original fetch time. AI reports retain that entire snapshot, not a manufactured live status.

The report separates facts, interpretation, mentioned entities and possible activities. Every
supporting quote must match a contiguous passage in the article title or body. Matching tolerates
only whitespace runs/line endings, straight-versus-curly single/double quotation marks and one
paired outer double-quote wrapper added around an excerpt. Full-source matches take precedence;
saved evidence is restored to the exact original source passage without invented wrappers.
Changed wording, case, numbers, omitted
words and other punctuation are not normalized. Unverifiable quotes reject the report atomically;
the error identifies the evidence field and rejected quote. The existing 800-character evidence
limit also applies to restored source passages; exceeding it produces a specific validation error,
not truncation or automatic retry. Related campaign
activities reference authoritative CG IDs and appear under **Related Community Goals**, once
per goal; progress and destination are read from the saved structured snapshot. Explicit versus
possible linkage remains an AI assessment, not a verified gameplay relationship. Unlinked
activities appear as separate investigation leads. The prompt forbids repeating a linked or
possibly linked CG as an independent lead; no report creates any goals or permanent Atlas POIs.

Schema validation and ID/quote checks reject malformed evidence, unknown or duplicate CG
references and inconsistent relationships before persistence. These checks are not proof that
the interpretation is true or that an unlinked activity is genuinely separate: manual quality
review remains necessary. Absence from the current CG snapshot does not prove an old campaign
never existed. Dated historical campaign references can also support story updates, as described below.

The report shows its analysis time, model, source link, CG snapshot freshness and known input/
output token counts (unknown counts remain unknown). A changed archived article is flagged.
Reports are dated evidence, not live campaign availability, personal eligibility or rewards.

## Requests, persistence and limits

The narrow adapter uses the installed `@jdu/llm-client` low-level `ModelClient` and OpenAI provider,
with [strict structured output](https://developers.openai.com/api/docs/guides/structured-outputs).
No hosted tools, MCP, online research, conversation history or automatic repair/retry are enabled.
Provider response storage is disabled. Article/CG contents are untrusted input, not instructions.

Each explicit action permits one request: at most 60,000 serialized input characters, 6,000 output
tokens and a 90-second inference timeout. One article job runs at a time per installation;
simultaneous requests for that article share the job. No fixed monetary estimate is invented.
**Update analysis** reuses a successful saved report when the article revision, model, extractor
version, CG contents and selected earlier report identities match. Snapshot timestamps/cache-state alone do not cause another paid
request. Changed evidence can incur a new request after another explicit press or through the
separately enabled background queue described below.

Migration 27 adds `galnet_analyses` to the existing SQLite database. Successful reports
are keyed by an SHA-256 evidence/configuration digest; prior reports remain readable across
restart or key removal. Read endpoints do not perform inference. Failed, refused, truncated or
invalid output is not saved as a successful report; an older valid report remains visible.
Credits may still have been consumed if a provider request fails validation or persistence.
An explicit retry after a failure makes a new AI request and can consume credit again; there is no
automatic retry. Quote matching does not invoke another model or alter the archived source.

Navigating away cancels the browser request, not the shared installation job; a valid result
can finish and be saved for a later visit. Application shutdown aborts inference and waits before
closing SQLite; late/cancelled output is not persisted. Failures are visible in the article panel,
not silently retried. Background work is separately opt-in, as described below.

## Background work and historical catch-up (prototype)

Settings → Copilot → GalNet intelligence enables automatic analysis separately from Copilot tool
permissions. It is off by default to avoid charging an existing configured key without consent.
Once enabled, the installation checks the existing news/CG services every 15 minutes, including
when no browser is open. New articles published since background-state installation, and revisions
changed after a first observation, become durable sequential jobs. This installation timestamp is
created when migration 28 first runs; older installations are not silently backfilled.

New or changed CG briefings/objectives/destinations/expiry recheck up to 100 recent saved reports
that reference the campaign or mention its system. Progress quantities and fetch timestamps alone
do not trigger inference. A missing campaign never implies that the story ended. CGs with no
related saved article need no AI job: their structured records remain available directly.
Stale news/CG responses do not advance the automatic baseline or enqueue work.

With background analysis enabled, the existing five-second worker also checks saved version-3
reports for changed selected story context. Analysing an earlier related article manually or via
catch-up can therefore refresh an already analysed newer article. This uses the same bounded
context selection as analysis, not a separate story matcher. Queue jobs run in publication order,
including jobs admitted in separate batches. Corrected earlier articles must have a matching
successful report before their existing dependents refresh; dependents with stale earlier context
also wait. This readiness check applies to already queued jobs, including explicit catch-up:
blocked dependents remain pending without consuming an attempt, while unrelated work can proceed.
A successful prerequisite releases them on a later tick. A failed refresh leaves the last successful report intact and never retries unchanged
evidence, including after restart. A later genuine evidence change or explicit retry can proceed.
Context checks only revisit existing reports; they never start analysing uncovered history.

The GalNet sidebar shows queue status, the 20 most recently updated jobs and failures. **Analyse
older articles** explicitly queues up to 20 uncovered or outdated reports from the latest 100 retained archive
entries, selecting newest publications first but executing that batch oldest first so later articles
can use earlier saved coverage. Repeat for another batch after it completes. It works with
automation off. It does not crawl the web or claim to search the entire historical GalNet catalogue.
Already-current reports and pending/running articles are not queued again. Failed work requires
explicit catch-up or the individual article action; normal polling never retries it.

Migration 28 stores settings, observed revisions and jobs separately from the provider cache.
Migration 29 records the selected successful report per article separately from immutable analysis
history. Reusing an older valid cache entry selects it for subsequent reads too, without changing
its original analysis timestamp or deleting any other successful evidence.
Pending work survives restart. A request interrupted by a crash becomes failed on startup, since
credit may already have been used. Superseded queued revisions are skipped rather than labelled
as analyses of evidence never supplied. Disabling automation pauses unstarted automatic jobs;
an in-flight request may finish, and explicitly requested catch-up remains eligible.
Every producer shares a SQLite-enforced limit of 100 pending jobs. When full, automatic intake
keeps the unadmitted evidence eligible for a later poll and shows a queue-full notice. Observations
advance only after their idempotent job is durable, so an interrupted admission cannot lose work.

The queue has a configurable 1–50 attempt limit per UTC day (default 10). Failed and cached attempts
count conservatively; this is not a currency budget. Individual manual article actions are separate
and do not consume this queue allowance. Requests use the existing per-article input/output/time
limits; there is only one active article analysis, shared with manual actions. A missing active key
pauses inference; saving/replacing a key still requires the existing PHOENIX restart.

Reads of queue status, reports and related coverage never invoke the analyser. A running worker may
independently complete a previously authorized job while a page is open. The article panel polls
saved results so finished background work appears without needing navigation or another paid press.

## Related coverage and bounded story updates

Reports that identify the same exact named ship or person are offered as **Related coverage**.
This is a candidate timeline from up to 100 recent saved reports plus the selected report, ordered
by publication rather than analysis time. Shared systems/factions alone do not group articles.
Changed reports are excluded. Earlier articles can be analysed through catch-up; the timeline is
not an exhaustive story archive. Sources and individual activity/CG statuses stay visible.

Version-3 analysis supplies at most five earlier articles from those 100 saved reports, matched by
the same exact named ship or person in the current source. Corrected sources are excluded. The
model receives the original revisions, immutable prior activity IDs and their dated referenced CG
snapshots in the **same** bounded article request. The combined 60,000-character limit includes
this context; oversized input fails before inference rather than silently dropping evidence.
Shared names are candidates only: the model can reject unrelated coverage and return no story update.

Only independent activities receive editable lead IDs in this context; campaign activities remain
represented by their dated CG snapshots. The request-specific structured-output schema restricts
updates to those eligible IDs, or requires an empty list when there are none. Campaign-only
coverage can still produce a story summary and source-backed developments.

An accepted **Story update** preserves a combined summary, source-quoted developments and explicit
assessments of individual earlier leads: unresolved, resolved, superseded by a current activity or
reconciled to a known current/historical CG ID. IDs must come from supplied context. Resolution
requires quoted evidence published later than the original activity; replacement requires a valid
current independent activity. Unknown/duplicate IDs or unverifiable quotes reject the whole new
report without replacing the previous successful report. These checks constrain evidence identity,
not the truth of the model's interpretation. Original reports and revisions remain preserved.

Atlas reconciliation reads 100 recent saved reports but still plots only the 20 most recently
analysed articles. It applies the latest explicit assessment **per immutable lead**, not a whole-story
newest-wins rule. Omitted assessments keep leads; equal-publication conflicting assessments keep
them unresolved. Finding a missing ship therefore does not implicitly end a later combat appeal.
Age and absence from today's CG list never resolve a lead.

If an anchor article changes, or any supplied earlier revision/report identity changes, its previous
lead decisions no longer apply. `contextChanged` warns about this stale earlier evidence. When
background analysis is enabled, changed selected context (including newly analysed earlier coverage)
queues a story refresh under the same consent, capacity and daily allowance as other automatic
work. With automation off, use an explicit update or catch-up. Failed unchanged evidence is not
retried automatically. This remains a bounded account, not a complete story registry, fuzzy-name
search or exhaustive archive.

## Copilot access to saved reports

Copilot has two read-only Comms capabilities: `comms.list_galnet_analyses` (up to 20 recent
summaries, default 10) and `comms.get_galnet_analysis` (one article ID from the list or assessment sources).
The list is ordered by analysis time, not publication date, and includes only the selected successful
report per article. It is not the latest-news feed or an exhaustive record of events. No saved
report means the player needs to use **Analyse article**, not that nothing is happening.

Detail retains the original report's source/revision, dates, model, quotes, facts, interpretations,
leads and token usage. To avoid sending unrelated campaign briefings, its CG snapshot contains
only the campaigns referenced by that report, with the original snapshot timestamp/freshness.
Version-3 detail also retains story developments, per-lead decisions and the supplied historical
source/CG snapshots. List summaries include the saved story summary when present.
These are dated references, not duplicate goals or current campaign availability; the existing
Community Goals tool supplies current public data. Report prose remains untrusted AI output.

Both tools now use the same per-lead reconciliation as the Atlas, considering up to 100 recent
selected reports **before** applying the summary return limit. Summaries distinguish
`originalInvestigationLeadCount` (the original independent activities, including ended ones) from
`currentInvestigationLeadCount` (remaining independent activities after ended/reconciled leads
are excluded). The original article/story summaries remain historical prose, not recommendation
lists. A changed anchor yields a **null** current count, not a misleading zero.

Detail returns `currentInvestigationLeads` separately from the unchanged `report`, plus
`leadAssessments` containing the latest publication-dated assessments for its immutable leads.
Assessments retain reporting article/revision/cache identities, model, publication/analysis dates,
source links, evidence quotes and their source URL, explanations, replacement activity indices
and CG IDs. Replacement indices refer to that assessment's reporting article; its ID can be read
with the same detail tool. Equal-date conflicting dispositions remain unresolved and retain all
latest assessment sources rather than selecting by analysis/insertion order. Stale article/context
assessments and obsolete target report identities do not retire current leads.

Remaining `unknown` leads are not confirmed ongoing opportunities. Unlike the map, Copilot
includes leads with no known destination; it still excludes CG-linked and ended activities. A
changed anchor yields `currentInvestigationLeads: null` with no current assessments, while its
original evidence remains readable. Detail of a retained report outside the 100-report window can
use assessments in that window, including its selected identity for matching. Neither the list nor
detail claims exhaustive story history. No new tool or permission is introduced and these reads
still make no inference, source-refresh or persistence calls.

The current archived article title is labelled `currentArticleTitle`, separately from the saved
report. `articleChanged` warns when its revision no longer matches (including an unavailable
current archived revision). `contextChanged` separately identifies changed earlier evidence or
analysis; its old lead decisions are not current. Neither operation updates reports, refreshes news/CGs or invokes the
analyser; saved reports remain usable without a configured AI key. Normal chat generation still
has its usual AI cost—reading a report adds no separate analysis request.

Both tools appear under Comms in installation and profile permissions. New installations use
the normal read-tool defaults; existing saved allowlists are not expanded automatically. Enable
both tools at installation level and for the active profile if they are not already allowed.
The same registry enforces discovery/execution permissions for local, MCP and realtime callers.

## Atlas investigation destinations

The Atlas **Leads** toggle shows a separate, temporary layer from the selected successful report per
article, limited to the 20 most recently analysed articles. It does not analyse articles or refresh
news/CG sources. Only independent activities with an explicit system destination are eligible;
CG-linked activities stay in the existing CG layer. Ended activities and reports whose archived
article revision changed are excluded. Unknown status stays unknown, not confirmed live availability.

Version-2 extraction adds a nullable destination with an exact source quote. Validation requires
the quote to contain the named system with name boundaries (not a substring of another name),
and the report to identify it as a system entity. The prompt
requires the article to associate that system with the activity, not merely mention it; validation
cannot prove that semantic interpretation. Regions, nearby systems, unnamed station/body systems
and historical positions of movable ships are not substitutes for an explicit destination.

Existing version-1 reports remain readable without inventing destinations. **Update analysis** is
required to produce a current version-3 report and may consume API credits. Version-2 reports
remain readable with their existing destinations. No automatic migration invokes AI.
That notice appears beside each legacy article report, not as a technical count in the Atlas footer.
Leads with no explicit destination are described as having no known destination; reanalysis does
not guarantee that the source provides one.

Coordinates come from existing system cartography, with at most two concurrent lookups and one
lookup per distinct system name. A missing position, failed lookup or different canonical system
name leaves the lead unplotted; the Atlas reports unresolved systems instead of guessing. The
location panel retains the article link, source quotes, publication/analysis dates, model and status.
Markers are dated AI interpretations, not verified current opportunities. Explicit story assessments
can retire individual earlier leads as described above; ongoing/unknown reports still require
player judgement. Turning off Leads hides this layer without changing CGs,
bookmarks, the permanent POI catalogue or saved reports.

## Remaining scope

No web enrichment, personal CG tracking, exhaustive story registry or alias/fuzzy entity matching
is included. Semantic story quality and live gameplay opportunities still need player validation.
The non-AI CG page remains independent and usable without analysis. See #60 and
[the article archive](galnet-archive.md).
