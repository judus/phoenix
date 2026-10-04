# Application and domain complexity audit — 2026-10-04

Baseline: `95b502a` on main. Initial worktree clean. Complete source review, followed by six individually approved narrow implementations. No commit, push, live-data mutation or game input performed.

Scope: all 129 tracked application source files, all 34 tracked domain files, and 45 assigned tracked tests from `game-action-gateway.test.ts` through `phoenix-control-deck-configuration.test.ts`, inclusive. Inventory uses `git ls-files`, restricted to TS/TSX/JS/MJS/CJS/SQL. A pending row is not a coverage claim.

Contracts read: `.context/index.md`, `.context/current-state.md`, `.context/open-work.md`, `.context/codex-handoff.md`, `.context/control-deck-integration.md`. Current repository/source wins over dated context details. Control Deck remains independently owned and unchanged. HTTP validation does not establish the invariants of MCP, composition, retained data or telemetry callers. Unknown telemetry and side-effect safety must remain explicit.

## Findings and proof

Coverage complete: 129 application files + 34 domain files + 45 assigned baseline tests = **208 fully read files**. Additional supporting callers, contracts, repositories and tests were inspected separately and are not counted toward the assigned inventory. A tool batch that exceeded output budget was excluded from the read ledger and reread in smaller batches.

### Approved and applied

1. **A1 — identical raw integer predicates.** `cartography-observation-ingestion-service.ts:34,178`: `integerCandidate` and `integerValue` had identical `typeof number`, safe-integer and nonnegative predicates. `ScanOrganic.Body` now uses the existing helper. Journal records carry unknown field values; the checks themselves remain necessary and were not removed. Characterization persists IDs through the actual in-memory SQLite repository for valid zero/positive numbers and rejects strings, objects, null, fractional/negative/unsafe/nonfinite numbers exactly as before.
2. **A2 — repeated capability-policy scans.** `copilot-capability-service.ts:143`: control-tool visibility previously filtered the whole command catalogue through `isDescriptorEnabled`, which reloaded and normalized settings for each command. Catalogue/registry availability is synchronous; one enabled-ID set per call with `some` preserves the predicate while avoiding nested catalogue/settings work. Empty or navigation-only catalogues still short-circuit without any settings read. No cross-call cache: subsequent policy changes remain visible. `controls.set_control_state` still requires a permitted game action, not only a macro. Existing execution-time authorization in `CopilotCommands` and registry remains unchanged. Tests cover 100 commands, one settings read, policy refresh, navigation-only/empty readers that throw if touched, and macro-only semantics.
3. **A3 — dead uppercase matcher.** `commander-equipment-catalogue.ts:90`: `humanize` first calls `normalize`, which lowercases its entire input; the subsequent lowercase-to-uppercase boundary regex therefore could never match. Only that dead regex was removed. Tests characterize unknown suit, weapon, modification and resource labels plus localized-name precedence. This does not change other humanizers that receive mixed-case raw values.
4. **A4 — quadratic targeted module scans.** `default-runtime-state-projector.ts:20`: each targeted module previously filtered/normalized all installations to count matching IDs. Normalized multiplicities are now computed once in the targeted branch. The `moduleIds === null` all-module branch remains first; exact trim/lowercase/Frontier-token normalization remains identical. Unique targets receive observed health, duplicate module types remain `null`, and untargeted objects are returned directly by the helper. `RuntimeStateSchema.parse` intentionally clones at the public projection boundary, so assertions characterize visible values rather than demanding external reference identity. Tests were green before implementation for multiple targets, duplicate normalized IDs, unrelated modules and all-module repair; existing journal/AFMU tests remain.
5. **A5 — fabricated intermediate deficit.** `engineering-project-service.ts:148`: internal aggregate values used `missing: 1`, but no caller could observe or read this field before the final map overwrote it from `required - owned`. Internal type now omits `missing`; final calculation, positive-deficit filter, priority/order and public schema remain unchanged. Characterization before implementation covered multiple steps/projects with exact project counts/priority and fully owned materials disappearing from the watchlist. Unknown recipe/material checks remain necessary.
6. **A6 — macro wait listener cleanup (real lifecycle defect).** `macro-service.ts:202`: normal timer completion previously retained its once-abort callback on the composed signal. A 12-wait real MacroService test failed with 12 retained listeners before the change; it passes with zero afterward. A named abort callback is removed on successful timeout. Aborts still clear the timer and reject the exact `signal.reason`; existing held-action release and playback statuses remain unchanged. No timer-framework migration or playback cancellation weakening.

### Rejected or deferred

- **R1 — remove application validation because HTTP already validates: rejected.** Typed query services also have MCP JSON adapters and direct composition callers; saved parameters and provider caches are retained unknown data. Raw journal/status fields are not guaranteed by HTTP request schemas. Keep required-name, range/date, type, safe-integer, provider-result and catalogue ambiguity checks unless the exact owning boundary proves them redundant.
- **R2 — remove organic-sample fallbacks from projection: deferred.** The current SQLite stored-observation schema normalizes legacy fields/defaults, but the domain repository port and custom fixtures can supply local records independently. Removing defensive `organicSamples ?? []` would strengthen this port without proving every caller; no change selected.
- **R3 — merge all provider caches into one implementation: deferred.** ProviderQueryCache validates unknown retained/provider responses, while SystemCartography also merges local evidence and has distinct local/stale fallback; GalNet returns its own fetch timestamp semantics. A superficial extraction would alter useful boundaries rather than merely reduce complexity.
- **R4 — broadly rewrite nested runtime projections or the large station-market service: deferred.** Event-specific merge ordering, null readings and source-specific filters have meaningful behavioral contracts. This pass selected only proven local duplication, not architectural rewrites on line-count evidence alone.
- **D1 — rejected macro release may strand playback: deferred behavior change.** `macro-service.ts:162` awaits `releaseHeldActions` before resetting `activeRun` at line 163. Production composition constructs `LoggedGameActions(new GameActionService(...), activityLog)` (`phoenix-application.ts:376`) and passes that to MacroService (`:396`). `logged-game-actions.ts:21` calls `activityLog.ingestAction` after dispatch; `activity-log-service.ts:88` writes durable activity and then invokes live listeners without swallowing exceptions. A repository/listener failure during a release can reject the finalizer after input was sent, leaving playback marked running. Correct handling must preserve uncertain game-input outcomes and reporting of cleanup failures; intentionally not folded into a behavior-preserving simplification. Add a dedicated rejecting-release/activity-writer test before any future fix.

### Validation

- A1–A3 focused run: `npx vitest run tests/application-complexity-simplification.test.ts tests/copilot-capabilities.test.ts tests/cartography.test.ts tests/exploration-body.test.ts` — **4 files, 21 tests passed**.
- A4/A5 characterization on old source — **2 files, 13 tests passed**; A6 regression failed as expected with **12 retained listeners**.
- After A4–A6: `npx vitest run tests/ship-hull-health.test.ts tests/macro-service.test.ts tests/application-complexity-simplification.test.ts tests/copilot-capabilities.test.ts` — **4 files, 25 tests passed**.
- `npm run typecheck --workspace @phoenix/server` — passed after all six changes.
- Parent owns whole-repository checks and package smoke validation after concurrent edits settle. No live Elite behavior is claimed by simulated input/unit coverage.

## Exact file ledger

Every row below was fully read. `retain` means no proven behavior-preserving simplification selected. Applied candidates and deferrals are identified explicitly with supporting call-flow and test evidence above.

| File | Disposition and rationale |
| --- | --- |
| `apps/server/src/application/activity-log-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/cached-cartography-station-resolver.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/cartographic-system-projector.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/cartography-observation-ingestion-service.ts` | A1 approved/applied: identical raw integer predicate consolidated; other journal/retained guards retained. |
| `apps/server/src/application/catalogue-diagnostics-service.ts` | retain: catalogue identity/ambiguity and normalized presentation ownership. |
| `apps/server/src/application/catalogue-ship-loadout-enricher.ts` | retain: catalogue identity/ambiguity and normalized presentation ownership. |
| `apps/server/src/application/catalogue-suggestion-service.ts` | retain: catalogue identity/ambiguity and normalized presentation ownership. |
| `apps/server/src/application/command-catalogue-service.ts` | retain: catalogue identity/ambiguity and normalized presentation ownership. |
| `apps/server/src/application/command-dispatcher.ts` | retain: command discovery, availability, correlation and side-effect dispatch boundaries. |
| `apps/server/src/application/commander-equipment-catalogue.ts` | A3 approved/applied: dead uppercase regex after lowercase removed; catalogue/localized/fallback precedence retained. |
| `apps/server/src/application/commander-equipment-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/commander-log/activity-commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/career-commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/commander-log-event.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/commander-log-service.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/finance-commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/fleet-commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/group-engineering-rolls.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/commander-log/mission-commander-log-projector.ts` | retain: event-specific projection, stable IDs and honest partial journal evidence. |
| `apps/server/src/application/communication-data-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/control-deck-elite-game-action-gateway.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/control-output-bootstrap.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/copilot-capability-service.ts` | A2 approved/applied: one policy read per control-tool check; empty/navigation-only and immediate permission changes preserved. |
| `apps/server/src/application/copilot-commands.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-conversation-event-service.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-profile-service.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-realtime-service.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-text-service.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-tool-registry.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/copilot-voice-host-coordinator.ts` | retain: profile/conversation/access lifecycle boundaries; no cross-call permission cache. |
| `apps/server/src/application/create-phoenix-control-deck-command-integration.ts` | retain: command discovery, availability, correlation and side-effect dispatch boundaries. |
| `apps/server/src/application/dashboard-market-signal-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/default-command-registry.ts` | retain: command discovery, availability, correlation and side-effect dispatch boundaries. |
| `apps/server/src/application/default-commander-engineers-query.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/default-exploration-body-query.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/default-exploration-target-query.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/default-navigation-query.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/default-runtime-state-projector.ts` | A4 approved/applied: targeted normalized-ID multiplicities calculated once; all-module/null fast branch and ambiguous health=null retained. |
| `apps/server/src/application/default-station-market-query.ts` | retain/defer: large service; domain preconditions, result bounds and persisted provider guards are separate ingress concerns. |
| `apps/server/src/application/default-system-details-query.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/display-command-service.ts` | retain: command discovery, availability, correlation and side-effect dispatch boundaries. |
| `apps/server/src/application/display-page-catalogue.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/elite-destination-service.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/elite-inventory-ingestion-service.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/elite-journal-diagnostics-service.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/elite-journal-ingestion-service.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/elite-journal-projection-pipeline.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/elite-status-ingestion-service.ts` | retain: raw journal/status normalization and ordered projection own independent input boundaries. |
| `apps/server/src/application/engineering-data-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/engineering-project-service.ts` | A5 approved/applied: internal aggregate omits not-yet-derived missing; final material deficit/schema/filter/order retained. |
| `apps/server/src/application/exploration-data-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/fleet-data-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/galaxy-bookmark-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/galaxy-data-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/galnet-news-service.ts` | defer: specialized timestamp-bearing cache differs from ProviderQueryCache; do not silently change freshness/result contract. |
| `apps/server/src/application/game-action-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/game-event-ingestion-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/health-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/local-traffic-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/logged-game-actions.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/macro-risk.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/macro-service.ts` | A6 approved/applied: successful wait removes abort listener; abort reason and held-action release unchanged. D1 deferred: cleanup rejection can strand activeRun. |
| `apps/server/src/application/market-signal-service.ts` | retain: explicit read-model/application responsibility; no proven redundant branch selected. |
| `apps/server/src/application/mcp-tools/commander-get-current-state-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/comms-list-messages-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/control-execution-errors.ts` | retain: exhaustive typed outcome switch; authorization, cancellation and ambiguous side-effect failures remain distinct. |
| `apps/server/src/application/mcp-tools/controls-execute-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/controls-find-actions-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/controls-get-status-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/controls-set-switch-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/controls-tap-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/display-open-page-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/display-show-body-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/display-show-system-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/engineering-list-engineers-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/engineering-list-material-inventory-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/equipment-get-report-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/exploration-get-current-body-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/exploration-search-targets-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/factions-search-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/fleet-list-ships-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/fleet-list-stored-modules-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/markets-find-best-trade-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/markets-find-trade-opportunities-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/missions-list-missions-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/navigation-can-jump-to-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/navigation-get-route-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/ship-get-cargo-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/ship-get-status-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/ship-list-modules-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/ships-compare-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/ships-get-definition-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/station-reference-schema.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-find-nearest-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-find-shipyards-selling-ship-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-find-stations-selling-module-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-get-details-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-list-shipyard-stock-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-lookup-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/stations-search-outfitting-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/systems-get-details-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/systems-search-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mcp-tools/tool-error-boundary.ts` | retain: public-safe structured error categories; unknown/internal failures never relabeled as model usage mistakes. |
| `apps/server/src/application/mcp-tools/tool-gateways.ts` | retain: narrow capability ports; no executable branches to simplify. |
| `apps/server/src/application/mcp-tools/tool-support.ts` | retain: helpers validate unknown JSON arguments across non-HTTP callers; raw type/range checks are necessary. |
| `apps/server/src/application/mcp-tools/web-search-tool.ts` | retain: schema and capability-specific argument/output adaptation; unknown JSON input and honest missing data preserved. |
| `apps/server/src/application/mission-data-service.ts` | retain: monotonic status reconciliation, partial provenance, backfill/snapshot distinctions; raw journal guards necessary. |
| `apps/server/src/application/mission-runtime-context.ts` | retain: bounded eight-mission supplement and explicit partial evidence. |
| `apps/server/src/application/navigation-data-service.ts` | retain: optional current-system resolution; unknown current name remains a required precondition. |
| `apps/server/src/application/numpad-command-service.ts` | retain: stale map revision, quick-deck omission, exact target conversion and hold lease dispatch are behavior-critical. |
| `apps/server/src/application/openai-configuration-service.ts` | retain: active startup key differs intentionally from desired persisted key; restartRequired comparison is necessary. |
| `apps/server/src/application/personal-equipment-planner-service.ts` | retain: unknown installed modifications occupy slots; ambiguous symbols fail rather than choosing a recipe. |
| `apps/server/src/application/personal-equipment-report-service.ts` | retain: catalogue consistency and explicit observed inventory/grade/access unknowns. |
| `apps/server/src/application/personal-equipment-specialists-service.ts` | retain: unobserved access remains unknown unless complete journal coverage proves locked. |
| `apps/server/src/application/personal-equipment-upgrades-service.ts` | retain: referential integrity and contiguous grade paths; catalogue-port checks not assumed redundant from a single concrete loader. |
| `apps/server/src/application/personal-material-inventory-service.ts` | retain: observed lot aggregation preserves null stores and mission-tagged quantities. |
| `apps/server/src/application/phoenix-control-deck-command-adapter.ts` | retain: explicit package-boundary translation; game action simulation/observable state not invented. |
| `apps/server/src/application/phoenix-control-deck-command-state-provider.ts` | retain: only actual boolean telemetry is exposed, missing state omitted. |
| `apps/server/src/application/phoenix-mcp-tools.ts` | retain: all 36 registered capabilities get one shared safe error boundary; no independent provider logic here. |
| `apps/server/src/application/provider-query-cache.ts` | retain: request-local in-flight deduplication; validation of retained/provider values and stale fallback serve distinct ingress paths. |
| `apps/server/src/application/route-completion-display.ts` | retain: arrival identity and pending final-jump state distinguish delayed journal arrival from cancellation/new journeys. |
| `apps/server/src/application/runtime-telemetry.ts` | retain: merges status flag groups; unknown telemetry is undefined, not false. |
| `apps/server/src/application/saved-galaxy-query-service.ts` | retain: schema validation, dynamic-origin normalization and single dashboard selection are application invariants. |
| `apps/server/src/application/shortcut-navigation-destinations.ts` | retain: saved IDs resolve latest data on execution; run ID forces repeated saved-query runs to navigate. |
| `apps/server/src/application/stateful-game-action-service.ts` | retain: accepted input differs from confirmed switch telemetry; cancellation polling and unconfirmed outcome retained. |
| `apps/server/src/application/station-name-suggestions.ts` | retain: bounded edit-distance suggestions never automatically resolve a station. |
| `apps/server/src/application/station-reference-resolver.ts` | retain: exact market ID/name precedence; suggestions and current-place fallback remain distinct. |
| `apps/server/src/application/system-cartography-service.ts` | retain: specialized external/local fallback and case-insensitive in-flight lookup; cannot substitute generic cache without semantic changes. |
| `apps/server/src/domain/cartography.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/commander-equipment.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/commander-log.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/commands.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/communications.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/copilot-capabilities.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/database.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/elite-destination.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/elite-journal.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/elite-status.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/engineering-projects.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/exploration-target.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/exploration.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/fleet.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/galaxy-bookmarks.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/galnet.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/game-actions.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/macros.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/missions.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/navigation.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/numpad.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/personal-equipment-planner.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/personal-equipment-report.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/personal-equipment-specialists.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/personal-equipment-upgrades.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/personal-materials.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/provider-query-error.ts` | retain: explicit safe provider categories/message mapping; diagnostic causes stay private. |
| `apps/server/src/domain/publisher.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/runtime-state.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/saved-galaxy-queries.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/ship-loadout.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/station-market.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/system-configuration.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `apps/server/src/domain/web-search.ts` | retain: explicit typed domain port/identity contract; no proven redundant executable branch selected. |
| `tests/game-action-gateway.test.ts` | retain: fully read; simulation adapter execution and unknown-action rejection. |
| `tests/game-action-semantics.test.ts` | retain: fully read; request identity, idempotency, cancellation, timeouts, lease renewal/expiry/shutdown and late press closure. |
| `tests/game-catalogue.test.ts` | retain: fully read; immutable catalogue copies, aliases, unknown inference and once-per-loadout engineering lookup. |
| `tests/help-page.test.tsx` | retain: fully read; canonical settings routes and indexed manual/deep-link fallback. |
| `tests/hold-gesture-controller.test.ts` | retain: fully read; serialized press/renewal/release; insecure-context browser ID fallback. |
| `tests/http-request-validation.test.ts` | retain: fully read; HTTP invalid/partial integers and impossible dates fail as client errors. |
| `tests/journal-controller.test.tsx` | retain: fully read; snapshot/live-event race and failure preservation. |
| `tests/json-conversation-store.test.ts` | retain: fully read; atomic persisted conversations, optimistic revisions, cursor/ownership errors and corrupt-file failure. |
| `tests/local-traffic.test.ts` | retain: fully read; bounded ambient deduplication, personal priority and real journal-to-API pipeline. |
| `tests/macro-api.test.ts` | retain: fully read; browser record/save/play integration and recording ownership. |
| `tests/macro-runtime-provider.test.tsx` | retain: fully read; browser identity, API recording and typed navigation. |
| `tests/macro-service.test.ts` | retain: fully read; A6 listener regression added; existing held-action abort release/risk/recording lease assertions retained. |
| `tests/macros-page.test.tsx` | retain: fully read; semantic recording conversion and honest playback presentation. |
| `tests/market-signals.test.ts` | retain: fully read; actionable ranking, cache reuse and live vs fixed saved origin. |
| `tests/material-trader-search.test.ts` | retain: fully read; exact trader subtype/pad filters, Vista Genomics and provider ordering. |
| `tests/mcp-session-registry.test.ts` | retain: fully read; idle expiry and least-recently-used capacity eviction. |
| `tests/mission-runtime-context.test.ts` | retain: fully read; compact active mission context with partial details. |
| `tests/missions.test.ts` | retain: fully read; acceptance/progress/redirect/terminal projection, snapshot backfill and durable normalization. |
| `tests/multi-select.test.tsx` | retain: fully read; select and clear actions through actual handlers. |
| `tests/navigation-css-boundary.test.ts` | retain: fully read; canonical selector ownership and visual-state restrictions. |
| `tests/navigation-display.test.ts` | retain: fully read; lossless cartography, neutral display publication and canonical page aliases. |
| `tests/numpad-api.test.ts` | retain: fully read; authoritative map, stale revision and hold-to-tap gateway simulation. |
| `tests/numpad-page.test.tsx` | retain: fully read; shared Numpy navigator markup and independent physical capture. |
| `tests/numpad-route-session.test.ts` | retain: fully read; return-route lifecycle and canonical navigation. |
| `tests/numpad-session.test.ts` | retain: fully read; prefix ambiguity, confirmation, zero cancellation and bounded keyboard input. |
| `tests/numpad-tile-grid.test.tsx` | retain: fully read; balanced grid and shared command metadata rendering. |
| `tests/openai-secret-repository.test.ts` | retain: fully read; owner-only atomic persistence and removal of temporary test secret. |
| `tests/operations-controller.test.tsx` | retain: fully read; mission-only subscription refresh and view lifecycle. |
| `tests/operations-page.test.tsx` | retain: fully read; honest mission evidence, title splitting and unobserved-vs-empty manifests. |
| `tests/outfitting-suggestions.test.tsx` | retain: fully read; canonical provider vocabulary, concurrent/retry catalogue cache and keyboard/stale-request behavior. |
| `tests/package-launcher.test.ts` | retain: fully read; temporary child-process readiness ownership and stop semantics; parent launcher changes reviewed in current source. |
| `tests/pairing-access.test.ts` | retain: fully read; per-device sessions/revocation, proxy restriction, dev-server pairing links and bearer transport. |
| `tests/pairing-gate.test.tsx` | retain: fully read; authorization gate, scanned-code bootstrap and explicit confirmation after failure. |
| `tests/personal-equipment-catalogue.test.mjs` | retain: fully read; technology-specific recipes, cumulative material plans and unknown-resource rejection. |
| `tests/personal-equipment-planner-service.test.ts` | retain: fully read; observed inventory subtraction and unresolved occupied modification slots. |
| `tests/personal-equipment-planner.test.ts` | retain: fully read; future-only grade/upgrade plans and incompatible/duplicate/overflow refusal. |
| `tests/personal-equipment-report.test.ts` | retain: fully read; joined ownership, recipes, material coverage and specialist access. |
| `tests/personal-equipment-specialists.test.tsx` | retain: fully read; canonical identity/location, unobserved access and API/detail routes. |
| `tests/personal-equipment-upgrades.test.tsx` | retain: fully read; source-recorded recipes, read API and recipe detail. |
| `tests/personal-materials.test.tsx` | retain: fully read; mission lots, honest null store coverage and side-by-side presentation. |
| `tests/phoenix-api-client.test.ts` | retain: fully read; global browser receiver, response validation and typed endpoint transport. |
| `tests/phoenix-brand.test.tsx` | retain: fully read; brand accessibility and lockup width. |
| `tests/phoenix-control-deck-adapter.test.ts` | retain: fully read; authoritative shared command adapter, simulated input and exact lease dispatch. |
| `tests/phoenix-control-deck-command-state-provider.test.ts` | retain: fully read; observable-only state publication and unsubscribe ownership. |
| `tests/phoenix-control-deck-configuration.test.ts` | retain: fully read; canonical configuration, optimistic writers and custom deck validation. |
