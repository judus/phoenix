# EDDN submission parity

Decision (2026-10-04): implement natively in PHOENIX. A selective uploader is not
a replacement for EDMC. Live publishing remains gated until coverage and behaviour
are verified. The existing seven-event acceptance does **not** establish parity.

## Reviewed upstream baselines

- EDMC: `89f410c9c75c16ff564068ab5201ed3d65ba68ce`, especially
  `plugins/eddn.py`, journal dispatch, stock exporters, CAPI exporters and sender.
- EDDN: `4ad669bb7bbe1eae080e4c354e786dca4db91f35`, developer rules and each
  schema/README. Official protocol rules take precedence over incidental EDMC behaviour.
- EDMC is a behavioural reference only. No GPL implementation is copied or translated.
  PHOENIX implements the documented protocol independently using explicit allowlists.

Sources: [EDMC reference](https://github.com/EDCD/EDMarketConnector/blob/89f410c9c75c16ff564068ab5201ed3d65ba68ce/plugins/eddn.py),
[EDDN protocol](https://github.com/EDCD/EDDN/tree/4ad669bb7bbe1eae080e4c354e786dca4db91f35/schemas).

## Gap register before implementation

| Input / behaviour | Initial state | Required work |
| --- | --- | --- |
| FSDJump, Location, Docked, Scan | Implemented | Audit field coverage and body augmentation; retain privacy allowlists |
| CarrierJump, SAASignalsFound | Missing | Journal schema mapping, system cross-check, nested signal/genus filtering |
| FSSDiscoveryScan, NavBeaconScan, ScanBaryCentre, FSSAllBodiesFound, FSSBodySignals | Missing | Dedicated schemas, exact system-name field, remove personal progress |
| ApproachSettlement | Missing | Preserve public site coordinates and station metadata; reject incomplete evidence |
| CodexEntry | Missing | Dedicated schema, remove personal discovery flags, validated body context from Status/journal |
| FSSSignalDiscovered | Missing | Contiguous batching; Odyssey pre-arrival ordering; strip mission targets and timers |
| DockingGranted / DockingDenied | Missing | Dedicated schemas, no invented system fields |
| NavRoute.json | Missing | Exact event/snapshot matching; route coordinates, not dashboard/provider data |
| FCMaterials.json | Missing | Exact event/snapshot/carrier matching; sanitized market items |
| Market / Outfitting / Shipyard | Implemented, gaps found | StationType/CarrierDockingAccess; snapshot Horizons flag; module symbol normalization; unchanged-stock suppression |
| Multicrew / session boundaries | Incomplete | No observations attributed to another captain; reset pending context safely |
| CAPI commodity / outfitting / shipyard / FC materials | Missing | Frontier app registration, PKCE login, token storage/refresh, commander/location checks, source-specific mappings |
| Delivery | Implemented, different limits | Review compression, payload/queue limits, deduplication, retention, interruption/retry and explicit loss reporting |

The old blackmarket schema is deprecated, not an implementation target: its replacement
is the commodity schema's prohibited list (CAPI source). There is no current EDDN schema
for ordinary Pioneer Supplies suit/weapon stock. ScanOrganic is not an EDMC EDDN dispatch;
do not invent an upload schema for it.

## Release gates and follow-up

1. Complete and test journal/file mappings, privacy and chronological context. Exercise the
   full service path, not just schema-valid happy paths. Synthetic tests never upload externally.
2. Keep field-level comparison current for the permissive journal schema; the bounded
   Powerplay/colonisation review below is not a guarantee of future-field or EDMC parity.
3. Keep CAPI/OAuth explicitly deferred from native journal/file readiness. Full EDMC source
   parity still requires separately approved authenticated CAPI coverage with PHOENIX's own
   registered client. Never use EDMC's ID or borrow its tokens.
4. Reconcile documented delivery differences, prove packaging and real-game acceptance,
   coordinate with maintainers, then deliberately review live release. Until then tell users
   to keep their existing uploader; test acceptance is not downstream ingestion proof.
5. Later add a read-only upstream checker comparing pinned revisions, schemas and protocol
   docs/EDMC uploader changes. Flag drift for review; never auto-update runtime behaviour.

No external registration, account authorization, maintainer contact, live upload, commit
or push is implied by this implementation work.

## Implemented in this pass

All 14 missing journal/file event families now have handlers: six generic journal events,
nine individual dedicated events, batched signals and five snapshots (21 total). Sixteen
local schemas enforce test-stream messages. The table above intentionally preserves the
initial gap findings; this section records their current disposition.

- Covered dedicated mappings, filtered nested signals/genuses, public settlement coordinates,
  direct or cross-checked Codex body identity, docking events and matched route/material files.
- Service-level tests cover each new journal handler, both auxiliary snapshots, pre-arrival
  signals, batching, mission/foreign-system filtering, replay, crew/session/opt-out boundaries,
  changed/unchanged stock, oversize rejection, and shutdown persistence.
- Station uploads now preserve station type/access and snapshot Horizons, normalize module
  prefixes and suppress unchanged stock. Unknown flags remain unknown.
- Delivery now uses gzip and a 2 MiB uncompressed safety cap. History is bounded by 100 entries,
  seven days and 16 MiB. A 2,500-system route passes without truncation.
- Package version advances to 0.1.3 to identify the changed submission content. The pin/hash
  manifest is `resources/eddn/upstream.json`. The opt-in [read-only upstream checker](eddn-upstream-checker.md)
  detects revision/schema/documentation drift; it never updates mappings or waives readiness gates.

## Remaining gaps, not waived

### Frontier account integration

The user confirmed no PHOENIX CAPI registration exists and was unfamiliar with it. It is a
developer OAuth client registration, not an EDDN account. Before implementing an end-to-end
login we need an approved PHOENIX identity/redirect and owner-controlled registration at
https://auth.frontierstore.net/client/signup. Do not register on the user's behalf or borrow
EDMC's identity. Never ask for a user's Frontier password or token in chat.

Design/validation still required: authorization-code PKCE and state binding, host-only callback
versus paired remote UI, protected refresh-token storage/revocation, live/legacy endpoint
selection, account/journal identity and location cross-checks, API-lag refusal, station refresh
scheduling/rate limits, and source-specific gameversion/Horizons. CAPI adds economies/prohibited
goods, station services/stock without opening each screen, unavailable ship listings and carrier
material orders. These are not reconstructed from external providers or invented from journals.
EDDN's developer guide warns of CAPI lag and prefers journals, but that does not erase EDMC's
additional CAPI coverage from this parity target.

### Journal fields and delivery policy

Frontier's [v38 manual](https://hosting.zaonce.net/community/journal/v38/Journal_Manual_v38.pdf)
was checked for travel/scan/Codex fields. The reviewed basic public fields are allowlisted; personal
travel flags (Taxi, Multicrew, InSRV, OnFoot), rank/reputation and unknown future fields are not.
The PDF itself does not fully describe current Powerplay/colonisation extensions. The bounded
review below supplements it with independent observed-journal contracts, not provider data.
Do not replace the allowlist with EDMC's generic pass-through-minus-exclusions just to claim parity.

#### Public-field review (2026-10-07, #112)

Compared the six generic journal mappings with the observed Odyssey journal contracts in
[ed-journal-schemas at e4976b5](https://github.com/jixxed/ed-journal-schemas/tree/e4976b5f9b46f784029364453622c2668087cfd6/schemas).
These are community-maintained source contracts, not Frontier or EDDN schemas. The pinned
[EDDN journal rules](https://github.com/EDCD/EDDN/blob/4ad669bb7bbe1eae080e4c354e786dca4db91f35/schemas/journal-README.md)
still govern event routing and privacy. The read-only upstream check found no pin drift.

- **Fixed:** `Scan.WasFootfalled` was dropped. The observed contract defines a boolean;
  [EDDI's independent journal parser](https://github.com/EDCD/EDDI/blob/d3b964ea7c8bb959ad6537f55b308f293a326905/JournalMonitor/JournalMonitor.cs)
  interprets it as existing first-footfall status, analogous to `WasDiscovered`/`WasMapped`.
  Preserve native true/false when present; do not infer a value or send a discoverer's identity.
- **Already covered:** Powerplay 2's `ControllingPower`, `Powers`, `PowerplayState`,
  `PowerplayStateControlProgress`, reinforcement/undermining counters and array-shaped
  `PowerplayConflictProgress` (`Power`, `ConflictProgress`) on `FSDJump`, `Location` and
  `CarrierJump`. Preserve source values without clamping or inventing alternate shapes.
- **Already covered:** colonisation station names/types, economies/services and conflict-stake
  symbols through existing public station/conflict mappings. New string values need no enum
  changes. Nested localisation and commander reputation remain excluded.
- **Not supported by EDDN:** standalone colonisation construction, contributions and claims,
  or personal Powerplay progress events. Public construction progress is not necessarily
  private, but currently has no supported schema/event route. Do not invent one or tunnel it
  through a different journal event. Station market snapshots keep their ordinary mapping.

Synthetic tests exercise these decisions through the contribution service, official schema
validator, SQLite outbox and injected transport, including false/absent first-footfall status,
zero and above-one Powerplay values, private nested siblings and unsupported event rejection.
No real player journals or external submissions were used. Dedicated schemas, CAPI, future
unknown fields and real-game acceptance are not signed off by this bounded comparison.

Our source-only deduplication, finite queue/24-hour expiry and no bootstrap/history upload are
intentional safety policies, not demonstrated EDMC equivalents. The bounded offline-policy review
(#114) verified file-backed recovery versus downtime omission, independent observation/admission
age limits, durable retry deadlines and queue/byte/receipt limits. These policies are retained,
not extended; see [offline policy](eddn-contribution.md#offline-policy-reviewed-2026-10-07-114).
Live journal rotation/session continuity was addressed in #109; low-severity #111 remains deferred.
Pinning schemas alone cannot establish these invariants. Authorized gameplay acceptance and
native runtime/packaging validation remain open in the [readiness checklist](eddn-readiness.md).
Until those gates are deliberately satisfied, keep the test-only gate.

Delivery-accounting follow-up: persistent reason totals now cover queue expiry, invalid queued
documents, HTTP rejection, capacity-skipped admission and deliberate clearing. Success and history
expiry no longer erase this evidence. Existing 24-hour retention and retry reservations remain;
open signal batches now checkpoint their last public envelope inside the bounded outbox. Resolved
checkpoints recover through ordinary validation; unresolved pre-arrival markers are counted invalid,
not reconstructed from bootstrap. Oversize/capacity skips and session clears are accounted for.
Live rotation now drains unread tails/intermediate files and preserves explicitly linked session
parts; startup remains newest-file-only without reconstructing missing earlier context.
Failed writes cannot preserve new data; gameplay acceptance remains open.
Capacity rejection before draft admission also lacks a loss retry when
the counter write fails (#108). This is not a full EDMC delivery-policy equivalence claim.
