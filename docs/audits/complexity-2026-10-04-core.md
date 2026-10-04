# Complexity audit: contracts, Elite ingestion and Copilot core

Baseline: `95b502a`, 2026-10-04. Scope: 55 package code files and 44 alphabetical test files (indices 134–177 of the 178 baseline tests). All 99 baseline files were read in full; cross-area callers were inspected where candidates needed proof. No baseline files remain pending.

## Candidate ledger

### P1 — accepted: trust already-normalized inventory payloads

`EliteInventoryFileSource.readFile` JSON-parses unknown bytes and calls `parseEliteInventoryFile`. Its dispatch reads a validated event string; `parseCargoInventory` / `parseMicroResourceInventory` each validate raw shape/defaults then parse the mapped canonical payload with the exact schemas reused by `EliteInventoryFileSnapshotSchema`. That wrapper adds only a literal kind and reruns the same payload schema. Return a typed literal wrapper instead, keeping both raw and canonical validation. `EliteInventoryIngestionService` passes the snapshot to `GameEventIngestionService`, whose event schema remains untouched. No later mutation or external object is introduced between child parse and wrapper return. Preserve unsupported-event errors, optional arrays/IDs/defaults, rejected raw payloads, input immutability and discriminator mapping. Implemented after all 13 new characterization tests passed on the original parser; the same 13 pass after removing wrapper revalidation. The new direct-source test is `tests/elite-inventory-parser.test.ts`.

### P2 — retained: planner checks are domain rules, not redundant HTTP validation

`planPersonalEquipmentUpgrade` is exported independently of the server. Its `PersonalEquipmentPlanInput` allows arbitrary numbers and does not establish matching catalogue grades, distinct modifications, compatible recipes or free slots. The server request schema does not cover all derived installed state. Keep these checks in the domain function; tests intentionally call it directly with invalid combinations.

### P3 — deferred: engineering grade-map keys permit invalid intermediate state

`BlueprintRecordSchema.grades` validates values but uses unconstrained string keys, subsequently parsed as integers. This is a potential model weakness, not evidence that downstream grade checks can be deleted. Tightening acceptance would change catalogue compatibility/error behavior. No schema change made in this behavior-preserving audit.

### P4 — retained: nested commodity map is semantic deduplication

`commodityMap` indexes both normalized symbols and display names. `listCommodities` deduplicates alias entries by symbol before sorting/cloning. Input schemas do not forbid repeated symbols with distinct aliases; replacing this with a raw catalogue array would alter duplicate/last-value selection. Do not flatten it as a cosmetic simplification.

### P5 — retained: watcher/backfill state is temporal

File-source refresh queues serialize concurrent notifications; retries handle partial writes and listener failures. Journal byte offsets commit only complete/accepted lines and preserve failed listener retries. Backfill cancellation is checked between awaited events, not just before the outer loop. Diagnostics directory/options originate outside those classes, so TypeScript alone does not prove every diagnostic value runtime-valid. No validation or lifecycle guard removed.

## File-by-file coverage

| File | Disposition / reason |
| --- | --- |
| `packages/contracts/src/actions.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/bookmarks.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/cartography.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/catalogue-suggestions.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/commander-equipment.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/commander-log.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/commands.ts` | Reviewed — Exhaustive discriminated-target key; no redundant fallback branch. |
| `packages/contracts/src/communications.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/control-deck-layout-presets.ts` | Reviewed — Bounded deterministic slot generation; optional preset lookup is intentional. |
| `packages/contracts/src/copilot-capabilities.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/copilot.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/display.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/elite-catalogue.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/elite-file-sources.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/elite-inventory.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/elite-journal.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/elite-status.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/engineering.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/exploration.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/fleet.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/galaxy.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/galnet.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/index.ts` | Reviewed — Exports/constants and health interfaces; no guarded execution. |
| `packages/contracts/src/macros.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/missions.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/numpad.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/pairing.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/personal-equipment-planner.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/personal-equipment-report.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/personal-equipment-specialists.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/personal-equipment-upgrades.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/personal-materials.ts` | Reviewed — Boundary schema/type definitions; nullable/default/strictness distinctions retained; no isolated guard removal. |
| `packages/contracts/src/runtime.ts` | Reviewed — Retain nullable telemetry and event union; factories establish required objects but observations remain unknown. |
| `packages/contracts/src/saved-galaxy-queries.ts` | Reviewed — Retain string-or-array parameter handling and legacy fixed-origin fallback; origin is not a guaranteed scalar. |
| `packages/contracts/src/settings.ts` | Reviewed — Retain host-policy refinement and target-adapter validation; external Control Deck types permit configurations PHOENIX rejects. |
| `packages/copilot/src/agent-profile.ts` | Reviewed — Retain disk metadata/path checks, rollback and required-file errors; interface types do not validate editable filesystem content. |
| `packages/copilot/src/index.ts` | Reviewed — Exports only. |
| `packages/copilot/src/runtime-context-renderer.ts` | Reviewed — Retain unknown/zero telemetry, partial rank and fuel/cargo distinctions; rendering branches express genuinely optional observations. |
| `packages/copilot/src/ship-module-presentation.ts` | Reviewed — Retain catalogue/inferred distinction and fighter/SRV purpose; module definition is nullable. |
| `packages/copilot/src/text-copilot-pipeline.ts` | Reviewed — Explicit new-versus-existing conversation branch; no speculative fallback. |
| `packages/elite/src/catalogue/json-game-catalogue.ts` | Reviewed — P4 retained: alias-map commodity deduplication and clone protect normalization/caller ownership; duplicate-symbol input is not forbidden. |
| `packages/elite/src/catalogue/suggestion-matching.ts` | Reviewed — Keep ordered matching, alias spelling, deduplication and size prefix semantics; shorter matching would change suggestions. |
| `packages/elite/src/engineering/json-engineering-catalogue.ts` | Reviewed — P3 deferred: string grade keys are weakly validated; tightening them changes accepted catalogues and needs migration policy. |
| `packages/elite/src/engineering/json-personal-equipment-catalogue.ts` | Reviewed — Unknown JSON parsed once, lazy cached, cloned per consumer; no repeated internal guard. |
| `packages/elite/src/engineering/personal-equipment-planner.ts` | Reviewed — P2 retained: public pure planner accepts independently constructed inputs; grade/slot/recipe/uniqueness checks are domain rules. |
| `packages/elite/src/index.ts` | Reviewed — Exports only. |
| `packages/elite/src/inventory/elite-inventory-file-source.ts` | Reviewed — P5: retain serialized reads, lifecycle/dedup/retry/offset and filesystem error handling. |
| `packages/elite/src/inventory/elite-inventory-parser.ts` | Reviewed — P1: redundant wrapper revalidation after canonical payload parsing; raw/default/normalization boundaries retained. |
| `packages/elite/src/journal/elite-journal-file-source.ts` | Reviewed — P5: retain serialized reads, lifecycle/dedup/retry/offset and filesystem error handling. |
| `packages/elite/src/journal/elite-journal-history-backfill.ts` | Reviewed — P5: retain serialized reads, lifecycle/dedup/retry/offset and filesystem error handling. |
| `packages/elite/src/navigation/elite-navigation-route-file-source.ts` | Reviewed — P5: retain serialized reads, lifecycle/dedup/retry/offset and filesystem error handling. |
| `packages/elite/src/navigation/elite-navigation-route-parser.ts` | Reviewed — Unknown route JSON normalized; absent route/optional coordinate/ID handling remains at ingress. |
| `packages/elite/src/status/elite-data-directory-locator.ts` | Reviewed — Explicit path versus platform-specific discovery; missing directory is a supported result. |
| `packages/elite/src/status/elite-status-file-source.ts` | Reviewed — P5: retain serialized reads, lifecycle/dedup/retry/offset and filesystem error handling. |
| `packages/elite/src/status/elite-status-parser.ts` | Reviewed — Unknown Status JSON validation and unsigned bit decoding; optional fields normalized before canonical schema. |
| `tests/phoenix-credits.test.tsx` | Reviewed — Formatting/negative-state assertions cover nullable credits and domain tone; explicit expectations retained. |
| `tests/phoenix-date-time.test.tsx` | Reviewed — Calendar conversion, machine timestamps and invalid dates are separate semantics. |
| `tests/phoenix-event-hub.test.ts` | Reviewed — Stream generation and stale cleanup tests prove temporal guards; fake events intentionally accept unknown payloads. |
| `tests/phoenix-event-stream.test.ts` | Reviewed — Frame buffering/cancellation handles split SSE chunks and a nullable Response.body boundary. |
| `tests/phoenix-mcp.test.ts` | Reviewed — Transport-level corrective feedback, policy, history sanitization and independent call results; consolidated fixture helpers suffice. |
| `tests/phoenix-providers.test.tsx` | Reviewed — Provider start/stop, typed display routing and device policy require distinct stateful fakes. |
| `tests/plotted-route.test.tsx` | Reviewed — Distance/progress/forward-only preview assertions preserve unknown progress and action dispatch semantics. |
| `tests/private-user-state.test.ts` | Reviewed — POSIX-only permissions plus optional SQLite sidecars are genuine platform/filesystem differences. |
| `tests/provider-query-cache.test.ts` | Reviewed — Malformed refresh, concurrent rejection/retry and delimiter collision are distinct cache invariants. |
| `tests/provider-query-error.test.ts` | Reviewed — Status, exception identity, response body and optional provider record distinctions protect safe classification. |
| `tests/quick-access-api.test.ts` | Reviewed — End-to-end shortcut IDs and deleted/renamed state prove per-execution authoritative resolution. |
| `tests/realtime-runtime-context-sync.test.ts` | Reviewed — Unchanged context versus replace/reset behavior proves lifetime-specific deduplication. |
| `tests/recent-journal-log.test.ts` | Reviewed — Bounded newest-first delivery and unsubscription; small repository fake does not need a shared abstraction. |
| `tests/rotating-wire-logger.test.ts` | Reviewed — Bounded valid records, redaction and rotation are not interchangeable cases. |
| `tests/route-completion-display.test.ts` | Reviewed — Detailed route-clear/status/journal arrival ordering proves temporal checks cannot be collapsed. |
| `tests/runtime-state-projector.test.ts` | Reviewed — Ingress schema rejection and negative-inventory adjustment are intentional independent assertions. |
| `tests/runtime-state-store.test.ts` | Reviewed — Late initial response and stop cancellation justify generation/revision guards. |
| `tests/runtime-state-stream.test.ts` | Reviewed — Reader/body guards and SSE framing are real transport constraints; cleanup retained. |
| `tests/saved-galaxy-queries-api.test.ts` | Reviewed — Persistent CRUD characterization through HTTP, isolated in-memory application. |
| `tests/saved-galaxy-queries.test.ts` | Reviewed — Legacy fixed origin, dynamic origin, dashboard uniqueness and migration checks are genuine state distinctions. |
| `tests/scrollable-log.test.ts` | Reviewed — Partial, exact and oversized rows independently exercise viewport remainder logic. |
| `tests/server-access-urls.test.ts` | Reviewed — Wildcard/explicit host and trusted local proxy tests support launcher correction I1. |
| `tests/settings-api.test.ts` | Reviewed — Secret persistence/redaction differs from domain capability mutations; independent applications retained. |
| `tests/settings-page.test.tsx` | Reviewed — Device-local settings, committed range changes and disclosed restart behavior are separate workflows. |
| `tests/setup-catalogue.ts` | Reviewed — Explicit environment isolation keeps tests offline and prevents real credentials/catalogues leaking into fixtures. |
| `tests/ship-hull-health.test.ts` | Reviewed — Unknown repair quantity, ambiguous module type and stale power state are intentional; A4 characterization preserves them. |
| `tests/sortable-data-table.test.tsx` | Reviewed — Sort cycle, null ordering and original source order cannot be merged into a shorter two-state test. |
| `tests/spansh-station-search.test.ts` | Reviewed — Pad unions before provider limits, variant deduplication and complete-query failure protect bounded search semantics. |
| `tests/spansh-system-search.test.ts` | Reviewed — Parameterized bounds prove explicit zero differs from absence and malformed population does not qualify. |
| `tests/sqlite-database.test.ts` | Reviewed — Idempotent initialization, retained checkpoints and replay uniqueness protect durable data boundaries. |
| `tests/stateful-game-action-service.test.ts` | Reviewed — Known-state no-input behavior differs from accepted-input telemetry confirmation; required runtime assertion retained. |
| `tests/station-market.test.ts` | Reviewed — Provider mapping, freshness-before-limit, bounded fan-out, cache policies and station identity are distinct integration cases. |
| `tests/station-name-suggestions.test.ts` | Reviewed — Canonical matching versus ambiguity/cap/unrelated inputs protects suggestion semantics. |
| `tests/station-reference-resolver.test.ts` | Reviewed — Market ID precedence and remote/current dock separation prohibit permissive fallback. |
| `tests/support/static-elite-dangerous-bindings.ts` | Reviewed — Isolated recording-only binding catalogue; clones keep independently mutating tests from sharing bindings. |
| `tests/system-configuration.test.ts` | Reviewed — Legacy migrations, preservation of corrupt/custom state and optimistic revision conflicts require separate paths. |
| `tests/system-schematic.test.tsx` | Reviewed — Nested/incomplete hierarchy, inferred attachments and retained zoom/carrier visibility are domain cases, not cosmetic repetition. |
| `tests/template-page.test.tsx` | Reviewed — Integration assertion checks real shell composition rather than a standalone placeholder only. |
| `tests/tool-domain-corrections.test.ts` | Reviewed — Invalid combinations must fail before provider/publication and corrected input must succeed; dual assertions retained. |
| `tests/tool-error-audit.test.ts` | Reviewed — All-tool boundary audit intentionally catches unknown failure; schema versus domain versus execution/cancellation meaning retained. |
| `tests/web-search.test.ts` | Reviewed — Mocked hosted adapter, bounded citations, scheme validation and public rate-limit feedback protect the external boundary. |
| `tests/widget.test.tsx` | Reviewed — Semantic heading, missing body and measured overflow differ; no invented default state. |
| `tests/workspace-focus.test.tsx` | Reviewed — Explicit focus/Escape and two-pointer gestures test different event lifetimes; no production simplification proven. |
| `tests/writable-agent-profiles.test.ts` | Reviewed — Read-only resources and independently writable profile data prove filesystem ownership and platform-specific permissions. |
