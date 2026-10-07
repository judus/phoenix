# EDDN community contribution

## Current release state

Implemented in PHOENIX's server, with no separate package or Control Deck dependency.
The installation preference is **on by default**, including older settings without the field.
Settings → General → Community data exposes the toggle, pending count, last success and diagnostic.

**Production uploads are gated off in this build.** There is no live-mode environment switch.
**EDMC parity is not complete. Keep an existing uploader enabled.** The native implementation
now handles all 21 journal/file event families in the pinned EDMC dispatch. CAPI is deferred;
real-game and native runtime acceptance remain open. See [parity register](eddn-parity.md) and
the [readiness checklist](eddn-readiness.md).
The UI distinguishes the enabled preference from unavailable delivery. An unavailable build
clears pending uploads on startup; it does not hold them for a future release. Developers can explicitly
set `PHOENIX_EDDN_TEST_MODE=1` for the official EDDN **test** schemas; this still transmits observations
externally, so use it only during an authorized test. The normal build sends nothing. Automated
tests use an injected transport or loopback HTTP gateway, never EDDN.

Before production activation: coordinate PHOENIX's sender identity/event families with EDDN
maintainers, validate real journals/snapshots in the test stream, verify native Windows packaging,
and review current upstream rules. Then deliberately introduce a release-controlled live policy
with development safeguards and a new application version. Do not simply remove `/test`.

## Ownership and data flow

- `packages/elite`: existing journal reader emits source identity and a startup-replay marker
  after successful normal projection. `EliteJournalSnapshotReader` reads only the five named
  game-owned files: Market, Outfitting, Shipyard, NavRoute and FCMaterials; 2 MiB maximum,
  no partial or changing reads accepted. Existing Status ingestion supplies Codex body context.
- `domain/eddn-message-builder.ts`: explicit field allowlists and chronological journal context.
  Journal: FSDJump, Location, Docked, Scan, CarrierJump, SAASignalsFound. Dedicated schemas:
  FSSDiscoveryScan, NavBeaconScan, FSSAllBodiesFound, FSSBodySignals, ScanBaryCentre,
  ApproachSettlement, CodexEntry, DockingGranted, DockingDenied, FSSSignalDiscovered.
  Snapshots: Market, Outfitting, Shipyard, NavRoute, FCMaterials.
  Session, movement, body and crew events maintain context without being submitted themselves.
  Unknown fields are not forwarded. Context is reset on session boundaries; uncertain evidence
  is skipped rather than reconstructed from external providers or current dashboard state.
- `EddnSchemaValidator`: locally pinned official schemas and draft-04 validation. No schema fetch
  occurs at runtime. Assets and licences are included in the installed payload.
- `EddnContributionService`: opt-out, journal eligibility, outbox admission and one-at-a-time
  background delivery. Journal callbacks do not wait for network requests. Contribution errors
  are contained and surfaced in its status, not propagated into cockpit projection.
- `SqliteEddnOutbox`: dedicated tables on the existing SQLite connection. No extra database or
  general-purpose message bus. Table initialization failure disables contribution without failing
  the application's startup.
- `EddnHttpTransport`: HTTP/1.1 gzip-compressed JSON POST, fixed official HTTPS gateway, 15-second timeout,
  abortable shutdown. Only a numeric-loopback HTTP endpoint can replace it for tests.

Settings/status use the existing paired HTTP boundary at `GET/PUT /api/settings/eddn`.
There is no arbitrary-message submission endpoint or Copilot submission tool.

## DEV submission log

DEV → EDDN (`#/developer/eddn`) shows up to the most recent 100 upload attempts, retained for up to
seven days and 16 MiB of payloads across restarts. Each row includes observation/system, time, attempt number, outcome
and HTTP status when received. Selecting it retrieves the exact filtered JSON upload, including
the commander uploader ID; it never exposes the unfiltered journal or remote response body.
History remains locally visible after opting out; disabling still clears only pending uploads.

Outcomes distinguish sending, accepted, retry scheduled, rejected and interrupted/unknown.
Accepted means an EDDN HTTP success, not confirmation that EDSM or other consumers ingested it.
Every retry has its own entry. A start record and durable retry reservation are written together
before network I/O; a crash can leave an attempt recorded without proof that bytes were sent.
Unfinished attempts become interrupted on restart, never assumed successful. Retry times describe
the decision at that attempt, not a guarantee of future delivery after expiry or disabling.

The paired endpoints are `GET /api/developer/eddn` (status and small summaries) and
`GET /api/developer/eddn/:id` (selected payload, 404 after retention expires). The page polls
summaries serially every five seconds and aborts reads on unmount; full payloads are not polled.
Retention bounds stored payload data to at most 16 MiB plus metadata. The log records
upload attempts, not bootstrap replays or observations skipped before queueing.

Settings and DEV also show persistent delivery totals: expired queue entries, invalid/corrupt
queued documents, permanent HTTP rejections, admissions skipped because the queue/receipt limit
was reached, and deliberate clears due to preference/build policy or session resets. Clears are labelled separately
from delivery failures. Counts and the latest occurrence time per reason are stored locally without
payloads, observation IDs or commander details. There are at most five aggregate rows; success,
restart, opting out and attempt-history retention do not reset them. Accounting begins when this
version first records a loss; earlier losses cannot be reconstructed. Pre-queue context/schema
filtering and failed checkpoint writes are not counted, so these are not total gameplay coverage.
If capacity rejects a signal before any draft is admitted and the loss-counter write also fails,
that rejection is not retried in the totals yet; bounded, once-only accounting is tracked in #108.
Queue removals and their counters are atomic: an accounting failure leaves the pending row intact.

For an authorized local development run, add `PHOENIX_EDDN_TEST_MODE=1` to the ignored `.env`
and restart the server. The normal default and packaged release gate remain unchanged.

## Evidence, privacy and replay policy

Messages carry `softwareName: PHOENIX`, the exact package version, original game version/build,
commander name as uploader ID, and known Horizons/Odyssey flags from `LoadGame`. Unknown flags
are omitted. EDDN obfuscates the uploader ID at its relay; upload itself includes that ID.
Shared observations reveal locations and observation times. The settings disclosure says so.
No raw journal, FID, credits, ship inventory or player reputation is forwarded. Remote response
bodies are not retained or displayed.

System augmentation requires matching `SystemAddress` and, when present, system name.
Station snapshots must match the triggering event's type, timestamp and MarketID, plus the
observed station/system. Invalid, missing, changing or mismatched snapshots are skipped; reopening
the relevant station service can produce fresh evidence. Market messages omit illegal and
non-marketable goods. Outfitting filters cosmetics, personal SKU unlocks and the approach suite.
Shipyard accepts the documented `PriceList` and observed `Pricelist` spellings at the input boundary.
Outfitting/Shipyard use a known snapshot Horizons flag; missing flags are omitted, not guessed.
Commodity includes station type/carrier docking access when present. Unchanged stock is suppressed
per schema within the current process; opt-out/session changes reset suppression. Rejected stock
can be observed again. Source receipts remain the durable deduplication mechanism.

FSSSignalDiscovered is buffered for a contiguous journal run, with incoming arrival context used
for Odyssey's pre-arrival ordering. Mission targets, localised strings and TimeRemaining are not
forwarded. Bootstrap, opt-out, commander and crew boundaries discard pending runs; a normal stop
can enqueue a run only against established context. Each accepted public signal checkpoints the
one public signal record under an unsealed row in the existing outbox; ordinary delivery cannot send it until
the run closes. Checkpoints share the same queue/byte/receipt/age bounds, not an additional spool.
Appending does not rebuild/validate/rewrite the whole run for each event. A per-batch byte counter
keeps checkpoint storage inside the shared budget. Closure or startup assembles the envelope once
and atomically replaces its checkpoint records with a sealed row. On restart, that last durable
run becomes eligible for ordinary schema, age and opt-in checks.
An unresolved pre-arrival run stores only a null marker, not raw events or guessed system context;
it is counted as invalid if recovery or shutdown cannot resolve it. Bootstrap cannot supply missing
arrival evidence or extend a recovered run. Oversized runs and draft growth rejected by capacity
are skipped as a whole with persistent invalid/capacity accounting. Session/crew/replay resets
discard the current unsealed row with a cleared count; recovered sealed rows remain independent.
Failed session discards retain only their IDs/reasons for retry, not the old event/context buffer.
Duplicate source runs are suppressed and draft cleanup cannot delete a sealed original or its lease.
No observations are submitted while joined to another captain's crew.

Failed non-capacity checkpoint writes remain visible and memory is retained for a later closing retry; a closed
run captures its original context so a retry cannot attach it to a later system. Only the last
successfully written checkpoint is crash-safe: storage failure before a write cannot preserve that
new signal. This is not a guarantee that all game signals or a whole interrupted run were collected.
During live play, journal rotation drains the previous tail and intervening files in order.
An observed `Continued.Part` followed immediately by the matching `Fileheader.part`, game version
and build preserves session context and pending signals; an unlinked or new-session header resets
them. These file markers do not close a pre-arrival signal batch. Startup still replays only the
newest journal file: starting in a later part without earlier context does not reconstruct that
context or upload history. See Frontier's [journal manual, File Format and Continued](https://hosting.zaonce.net/community/journal/v31/Journal_Manual_v31.pdf).

Codex uses explicit journal BodyID when present. A missing ID is inferred only when journal and
Status body names agree. Stale Status from before a location boundary cannot augment a new system.
Public discovery/site coordinates belong to Codex/settlement schemas; ordinary Location/Docked
coordinates remain excluded. The settings disclosure includes routes, signals and discoveries.

Startup rereads rebuild context but **do not submit** those historical lines. Historical backfill
is never connected to contribution. This intentionally does not backfill observations from while
PHOENIX was stopped. Only already-enqueued messages and durable signal checkpoints survive downtime
for later validation/delivery; startup replay never contributes new historical observations.
Source identity hashes file path, record end offset and original line; it is kept locally, not sent.
Receipts deduplicate repeated observations even after acknowledgement.

Turning off persists the preference, aborts in-flight delivery and clears pending messages.
Turning back on establishes a persisted timestamp boundary and does not resurrect the disabled
period. An already-transmitted message cannot be recalled. Events from the same timestamp second
as an opt-in may conservatively be skipped because game timestamps have lower precision.

No exactly-once guarantee: a crash after remote acceptance but before local acknowledgement can
cause a duplicate. A retry deadline is reserved before sending, so restart does not immediately
repeat an interrupted attempt.

## Limits and failure behavior

- Maximum message: 2 MiB serialized JSON; gzip on the wire. Long routes are not truncated.
- Pending queue: 1,000 messages / 16 MiB; receipts: 100,000.
- Queue/receipt retention: 24 hours. Observation timestamps older than 24 hours or more than
  five minutes in the future are not accepted. No timestamp rewriting.
- One send per worker tick (one second), with no overlapping sends.
- Network failures, HTTP 408/429 and 5xx retry after at least one minute, exponential backoff
  capped at one hour. Retry deadlines survive restart.
- Other non-success responses, including 400/413/426, are terminal. They are discarded with
  a diagnostic, not retried indefinitely. Invalid/corrupt/expired queued messages cannot block
  later entries. Queue capacity rejects new observations rather than allowing unbounded storage.
- Storage errors remain visible and delivery can retry on later ticks; startup initialization
  errors require recovery/restart. A failed clear is also constrained by the persisted opt-in
  boundary before any later delivery.

### Offline policy (reviewed 2026-10-07, #114)

"Offline" has two distinct meanings:

| Situation | What is retained or submitted |
| --- | --- |
| PHOENIX running, network unavailable | Eligible observations enter the bounded outbox. Failed attempts retry after their durable deadline; other due work can proceed. |
| PHOENIX closed, game continues | Gameplay written during downtime is **not uploaded on restart**. The newest journal's existing records rebuild context only; older files may feed local history, never EDDN. No station snapshots are read for replayed triggers. |
| Restart with already admitted work | Pending envelopes and resolved signal checkpoints recover from SQLite and are revalidated before sending, without requiring a fresh gameplay event. Bootstrap does not duplicate or extend them. |
| Restart without resolved signal context | An unresolved pre-arrival checkpoint is rejected, not repaired from replay or a later location. |
| Disabled preference or unavailable build | Pending work is deliberately cleared, not held. Re-enabling does not backfill the disabled period. Attempt history remains subject to its separate retention. |

There are **two independent 24-hour limits**. Queue rows and receipts expire from their first
local admission time, including unsealed signal batches. Separately, an original observation
timestamp at least 24 hours old is ineligible at admission and again before sending. Queue
pruning runs at startup and active worker ticks; timestamp rejection happens when a row is due.
Retries, checkpoint appends, sealing and restart do not refresh either timestamp. At the exact
24-hour boundary the corresponding limit expires. An admitted observation up to five minutes
ahead of the local clock is still subject to the admission-age limit.

The 1,000 pending entries and 16 MiB payload/checkpoint budget are shared by sealed messages
and open signal batches. Capacity rejects new work, not previously admitted messages. Growth
that exceeds a signal batch's budget rejects that batch as a whole. Acknowledged receipts still
occupy their independent 100,000-entry budget until their original 24-hour age limit. Successful
sends free pending capacity, not receipt capacity. Pruning frees aged receipts. These are logical
retained-data limits, not a cap on the physical SQLite/WAL file, total application memory or disk.

Attempt history has independent limits: newest 100 entries, seven days and 16 MiB. History
pruning neither removes pending work nor resets durable loss totals. Totals count discarded
queue entries/batches and capacity refusals, not every individual signal or all missed gameplay.
Pre-queue exclusions and writes that fail before persistence cannot be reconstructed from them.

These are deliberate PHOENIX safety policies, **not EDMC delivery equivalence**. The
[pinned EDDN retry guidance](https://github.com/EDCD/EDDN/blob/4ad669bb7bbe1eae080e4c354e786dca4db91f35/docs/Developers.md#sending-data)
requires a minimum retry delay and prohibits automatic retries of HTTP 400/426. PHOENIX also
treats 413 as terminal rather than taking the optional retry. This review does not extend retention,
add a history spool or promise complete coverage while the app is stopped. Expiry remains visible
even without an upload attempt. HTTP success is not downstream ingestion proof; a lost response
or crash between remote acceptance and local acknowledgement can still cause a later duplicate.

File-backed regression tests cover source bootstrap versus new append, restored pending work,
network retry deadlines and both age boundaries. Storage tests cover byte/receipt capacity in
addition to the existing row-count, signal-recovery and loss-counter tests. The only demonstrated
defect in this review was the unavailable-build feedback promising to hold uploads; it now
describes the existing clear policy. Low-severity #108/#111 remain separately tracked. See the
[readiness checklist](eddn-readiness.md) for work that cannot be signed off by synthetic tests.

## Sources and maintenance

Schemas are pinned at EDCD/EDDN revision `4ad669bb7bbe1eae080e4c354e786dca4db91f35`.
See `resources/eddn/README.md`, `THIRD_PARTY_NOTICES.md`, and `licenses/`.
Mapping code implements the documented protocol with PHOENIX allowlists; no EDMC or
EliteDangerousCore implementation was copied.

- [EDDN developer rules](https://github.com/EDCD/EDDN/blob/live/docs/Developers.md)
- [Journal rules](https://github.com/EDCD/EDDN/blob/live/schemas/journal-README.md)
- [Commodity rules](https://github.com/EDCD/EDDN/blob/live/schemas/commodity-README.md)
- [Outfitting rules](https://github.com/EDCD/EDDN/blob/live/schemas/outfitting-README.md)
- [Shipyard rules](https://github.com/EDCD/EDDN/blob/live/schemas/shipyard-README.md)

Recheck upstream schema and privacy rules before updating a pin or extending the event allowlist.
Machine-readable provenance and hashes: `resources/eddn/upstream.json`. A later read-only drift
checker will flag revisions for review, not auto-update production schemas or message mappings.
EDSM account sync and bulk historical uploads remain out of scope. CAPI/OAuth is explicitly
deferred from native journal/file readiness, not silently counted as implemented. Full EDMC source
parity would require that separately approved work, PHOENIX's own Frontier app registration and
an authenticated, separately validated source path. No registration exists.

## Native parity expansion (2026-10-04)

- Added 12 pinned schemas and 14 journal/file event families, bringing dispatch coverage to 21
  across 16 schemas. This is **not** a claim of full field/source/behaviour parity.
- Fixed station metadata, snapshot Horizons, module prefix normalization, stock suppression,
  Codex/body/crew context and batched signal ordering. Extended DEV summaries for SystemName,
  System and CarrierName without adding invalid fields to the wire format.
- Increased message capacity, gzip transport, independent history byte cap; retained test-only
  enforcement, opt-out, replay exclusion and privacy allowlists.
- Root app version is now 0.1.3 because EDDN requires softwareVersion to change when submitted
  content changes. No dependency versions changed.
- Read-only review of Frontier v38 travel/scan/Codex fields supplements the EDMC/schema audit.
  EDDN's permissive journal schema cannot prove every current game field is covered; the remaining
  field-level checks and delivery-policy differences are listed in the parity register.
- Full check passed: 202 files / 1005 tests, production typechecks/builds. Focused changed server
  tests also pass strict TypeScript. Socket tests use an isolated loopback gateway; no synthetic
  observations are sent to EDDN. Real-game acceptance of newly added families remains pending.
- Final mapping follow-up: five focused files / 75 tests and strict checks of six EDDN test files
  pass. Linux 0.1.3 payload build, 103-checksum verification and isolated installed-mode smoke
  pass. All 12 added schema files byte-match the pinned upstream source. No new installer or
  native Windows run is claimed.

## Verification (2026-10-04)

Real-game/test-stream acceptance follow-up:

- Read-only inspection of the running DEV log found 42 attempts: two `FSDJump` and 40 `Scan`,
  all accepted with HTTP 200, queue empty, no current contribution error. These came from actual
  gameplay after the user's explicit test-mode opt-in, not replay or injected fixtures.
- All 42 stored uploads revalidated against the pinned test schemas. A recursive supplementary
  check found none of the excluded commander/private or `_Localised` fields in their messages.
  No raw player payloads or uploader names were copied into documentation or test fixtures.
- SHA-256 comparison of all four pinned schema files with the current upstream `live` files
  matched exactly. Re-read developer, journal, commodity, outfitting and shipyard rules.
- Rebuilt Linux x64 payload with the DEV page: **90 checksums**, verification and installed-mode
  smoke pass. Smoke now checks unauthenticated log rejection, authenticated empty history and
  missing-payload 404 in addition to default-on/gated settings and persisted opt-out. This was
  an isolated payload test, not a new `.deb` installer or native Windows acceptance.

Remaining real-game checks (keep PHOENIX running with test mode and contribution enabled):

Station follow-up: Docked, commodity (355 entries) and outfitting (790 module symbols) were
accepted with HTTP 200 at Clark Landing, submission IDs 134–136. Queue empty, no current error.
All 100 retained attempts pass schema revalidation and the supplementary excluded-field check.
This is a rolling history, not a lifetime count. The station had no shipyard. The on-foot weapon
merchant is outside this implementation's event/schema allowlist; visiting it does not test ship
outfitting and does not produce a supported weapon-stock upload.

| Event/schema | Evidence so far | Trigger still needed |
| --- | --- | --- |
| `FSDJump` | 2 accepted | None for basic acceptance |
| `Scan` | 40 accepted | None for basic acceptance |
| `Location` | Automated only | Return to the main menu and re-enter the game |
| `Docked` | Accepted HTTP 200 | None for basic acceptance |
| Commodity | 355 entries accepted HTTP 200 | None for basic acceptance |
| Outfitting | 790 module symbols accepted HTTP 200 | None for basic acceptance |
| Shipyard | Automated only | Open Shipyard at a station that offers it |

No purchase, sale, ship transfer or game-setting change is necessary. Station checks can wait
until a convenient visit; a location relog can also wait. Check the DEV row and selected payload
against the just-visited station/system and original snapshot timestamp. A rejected or skipped
event is not a reason to force a historical resend or weaken identity checks. Session changes
and real opt-out/re-enable can be verified later; automated coverage already exists.

Before live release, native Windows packaging/runtime acceptance and maintainer coordination
remain open. Prepare PHOENIX's software identity/version, supported schemas/events, privacy
filters, test acceptance evidence, queue/retry policy and contact details for coordination.
Do not contact maintainers or enable live publishing without explicit authorization.

DEV log follow-up:

- Full `npm run check`: 201 test files / 961 tests; typechecks and builds pass.
- Added persistence/retention and interruption coverage, retry/rejection history, on-demand
  payload API coverage, DEV route/navigation, UI polling/selection races and paired-route checks.
- Strict checks pass for the modified EDDN service/storage/API tests and new page test.
- Isolated real-shell preview with synthetic submission history: PHOENIX/Elite landscape,
  Elite 900×1280 and 768×1024 portrait, native keyboard selection, selected JSON, internal scrolling
  and no horizontal clipping verified. Fixture forces contribution unavailable, even when the
  invoking environment opts into test uploads. No fake observation is sent externally.
- Local `.env` now opts into test-stream delivery at the user's request. This does not enable
  live publishing or establish real-game/test-stream acceptance. No historical backfill.

Initial contribution implementation:

- `npm run check`: 200 test files / 955 tests, production typechecks and builds pass.
- Eight new test files also pass direct strict TypeScript checks (NodeNext for server/API tests,
  Bundler for the UI test, matching their respective production module-resolution modes).
- `npm run payload:build`, `payload:verify`, `payload:smoke`: Linux x64, 89 checksums,
  read-only installation, single instance, clean stop, default-on/gated contribution status,
  persisted opt-out, retained state, settings migration and corruption recovery pass.
- Real isolated PHOENIX shell: toggle off, API confirmation, reload persistence, PHOENIX/Elite
  landscape and Elite portrait checked. No additional CSS or isolated component shell introduced.
- One repeated test invocation was blocked by sandbox loopback restrictions (`EPERM`);
  the full checks and payload smoke passed when rerun with local socket access.
- No live journals, real player database or running application were modified. No observations
  were sent to EDDN, including its test stream. Owned browser/preview processes were stopped.
- Native Windows, real-game/test-stream acceptance and maintainer coordination remain pending.
