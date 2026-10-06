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
2. Complete field-level comparison for the permissive journal schema, including current
   Powerplay/colonisation additions; an event-name checklist alone is insufficient.
3. Implement authenticated CAPI coverage with PHOENIX's own registered client. No existing
   CAPI/OAuth service was found in this checkout. Never use EDMC's ID or borrow its tokens.
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
The PDF itself does not fully describe current Powerplay/colonisation extensions. Finish their
field-level evidence review with current journal fixtures/provider contracts before signing off.
Do not replace the allowlist with EDMC's generic pass-through-minus-exclusions just to claim parity.

Our source-only deduplication, finite queue/24-hour expiry and no bootstrap/history upload are
intentional safety policies, not demonstrated EDMC equivalents. Durable queue-loss accounting is
implemented below; still review offline retention policy, long-running journal file rotation/session
continuity, and busy-system memory-only signal loss on crashes.
Pinning schemas alone cannot establish these invariants. New families also need authorized
gameplay acceptance and native Windows packaging validation. Until then, keep the test-only gate.

Delivery-accounting follow-up: persistent reason totals now cover queue expiry, invalid queued
documents, HTTP rejection, capacity-skipped admission and deliberate clearing. Success and history
expiry no longer erase this evidence. Existing 24-hour retention and retry reservations remain;
memory-only signal crash loss, rotation/session continuity and gameplay acceptance are still open.
