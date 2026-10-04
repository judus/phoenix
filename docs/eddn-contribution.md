# EDDN community contribution

## Current release state

Implemented in PHOENIX's server, with no separate package or Control Deck dependency.
The installation preference is **on by default**, including older settings without the field.
Settings → General → Community data exposes the toggle, pending count, last success and diagnostic.

**Production uploads are gated off in this build.** There is no live-mode environment switch.
The UI distinguishes the enabled preference from unavailable delivery. Developers can explicitly
set `PHOENIX_EDDN_TEST_MODE=1` for the official EDDN **test** schemas; this still transmits observations
externally, so use it only during an authorized test. The normal build sends nothing. Automated
tests use an injected transport or loopback HTTP gateway, never EDDN.

Before production activation: coordinate PHOENIX's sender identity/event families with EDDN
maintainers, validate real journals/snapshots in the test stream, verify native Windows packaging,
and review current upstream rules. Then deliberately introduce a release-controlled live policy
with development safeguards and a new application version. Do not simply remove `/test`.

## Ownership and data flow

- `packages/elite`: existing journal reader emits source identity and a startup-replay marker
  after successful normal projection. `EliteStationSnapshotReader` reads only the three named
  game-owned station snapshot files; 2 MiB maximum, no partial or changing reads accepted.
- `domain/eddn-message-builder.ts`: explicit field allowlists and chronological journal context.
  Only `FSDJump`, `Location`, `Docked`, `Scan`, `Market`, `Outfitting`, and `Shipyard` are submitted.
  `Fileheader`, `LoadGame`, `CarrierJump`, `StartJump`, `Undocked`, and `Shutdown` maintain context.
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
- `EddnHttpTransport`: HTTP/1.1 JSON POST, fixed official HTTPS gateway, 15-second timeout,
  abortable shutdown. Only a numeric-loopback HTTP endpoint can replace it for tests.

Settings/status use the existing paired HTTP boundary at `GET/PUT /api/settings/eddn`.
There is no arbitrary-message submission endpoint or Copilot submission tool.

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

Startup rereads rebuild context but **do not submit** those historical lines. Historical backfill
is never connected to contribution. This intentionally does not backfill observations from while
PHOENIX was stopped. Only already-enqueued messages survive downtime for later delivery.
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

- Maximum message: 128 KiB serialized JSON.
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
EDSM account sync, CAPI authentication and bulk historical uploads remain out of scope.

## Verification (2026-10-04)

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
