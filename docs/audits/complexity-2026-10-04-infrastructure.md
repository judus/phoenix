# Infrastructure complexity review — 2026-10-04

Baseline: `95b502a`. File-by-file source audit: 68 infrastructure/scripts/config files and 45 assigned test/fixture files fully read (113 total). Only two parent-approved production changes implemented. Control Deck, generated/vendor files, live databases, network and game input stayed outside this review.

## Coverage ledger

Every row below denotes a full-file read, not a text-search hit. Context index, current state, handoff, open work, coding guidelines, integration and reference-source contracts were read. Additional caller traces include cartography domain/schema, existing cartography migration tests, application default host, main ready-file emission and server URL normalization.

| File | Disposition |
| --- | --- |
| `apps/server/src/infrastructure/application-paths.ts` | Kept: explicit installed/development and platform roots define ownership; null overrides are meaningful. |
| `apps/server/src/infrastructure/ardent-station-search-source.ts` | Kept: normalize unknown provider fields and optional report data; catalogue fallback and null prices are real contracts. |
| `apps/server/src/infrastructure/catalogue-snapshot-loader.ts` | Kept: small resource assembly without speculative abstraction. |
| `apps/server/src/infrastructure/catalogue-snapshot-refresh.ts` | Kept: bundled seed, schema checks and background refresh protect startup/offline ownership. |
| `apps/server/src/infrastructure/configured-copilot.ts` | Kept: optional client/profile construction and configuration failure context remain explicit. |
| `apps/server/src/infrastructure/control-deck-elite-destination-input.ts` | Kept: finally-release and separate input deadlines protect held keys, not redundant guards. |
| `apps/server/src/infrastructure/copilot-audio-config.ts` | Kept: boundary catch adds actionable file context and diagnostic cause. |
| `apps/server/src/infrastructure/default-control-deck-configuration.ts` | Kept C3: quick navigation briefly builds then replaces a game-action target; contained startup-only construction, low-value cosmetic change. |
| `apps/server/src/infrastructure/edsm-cartography-source.ts` | Kept: unknown external documents, absent-system distinction and unit normalization require defensive checks. |
| `apps/server/src/infrastructure/edsm-station-stock-source.ts` | Kept: missing stock arrays legitimately mean no reported stock; invalid root remains typed malformed. |
| `apps/server/src/infrastructure/fetch-provider-json.ts` | Kept: explicit HTTP/network/JSON categories and timeout checks; no unsafe retry or raw response leak. |
| `apps/server/src/infrastructure/frontier-galnet-source.ts` | Kept: official API shape and article schema are external trust boundaries. |
| `apps/server/src/infrastructure/galaxy-map-binding-diagnostics.ts` | Kept: compare both camera slots and modifiers; nested loops preserve multiple independent warnings. |
| `apps/server/src/infrastructure/in-memory-control-deck-configuration-repository.ts` | Kept: revision conflicts and schema-derived snapshots prevent shared mutable configuration. |
| `apps/server/src/infrastructure/in-memory-navigation-route-store.ts` | Kept: schema validation and read cloning protect store ownership. |
| `apps/server/src/infrastructure/in-memory-runtime-state-store.ts` | Kept: validate writes and clone reads at public state boundary. |
| `apps/server/src/infrastructure/in-process-publisher.ts` | Kept: minimal Set-based subscription/publish lifecycle. |
| `apps/server/src/infrastructure/json-conversation-store.ts` | Kept C4: fresh parsed records may be cloned again by callers, but queue identity, atomic writes and ownership matter; do not remove clones mechanically. |
| `apps/server/src/infrastructure/json-openai-secret-repository.ts` | Kept: private atomic secret persistence and explicit absent-file handling. |
| `apps/server/src/infrastructure/json-system-configuration.ts` | Kept: migration/current-schema distinction preserves corrupted data; repeated permission normalization is idempotent but startup compatibility, not a cleanup target. |
| `apps/server/src/infrastructure/macro-repositories.ts` | Kept: explicit mapping/order and cloned configuration ownership. |
| `apps/server/src/infrastructure/notifying-command-source-repositories.ts` | Kept: publication follows successful repository mutation; wrappers preserve failure ordering. |
| `apps/server/src/infrastructure/openai-realtime-client.ts` | Kept: external response validation, secret redaction and unavailable configuration cases are genuine boundaries. |
| `apps/server/src/infrastructure/openai-web-search-source.ts` | Kept: Responses graph traversal, source deduplication and timeout/error separation preserve provider semantics. |
| `apps/server/src/infrastructure/pairing-access-controller.ts` | Kept: thin delegation to Control Deck authentication, no local replacement policy. |
| `apps/server/src/infrastructure/phoenix-http-server.ts` | Deferred C5: large explicit route ownership is a future focused decomposition; generic dispatch now risks authorization, validation and response ordering. SSE idempotent close guards retained. |
| `apps/server/src/infrastructure/phoenix-mcp-server.ts` | Kept: bounded session retention, cancellation and request/session errors are required lifecycle protections. |
| `apps/server/src/infrastructure/private-user-state.ts` | Kept: POSIX permission branches intentionally differ from Windows. |
| `apps/server/src/infrastructure/rotating-wire-logger.ts` | Kept: bounded byte rotation and redaction; replacing branches could change retention. |
| `apps/server/src/infrastructure/server-access-urls.ts` | Kept: wildcard localhost advertisement traced to A1 launcher defect; forwarded/network URL trust checks retained. |
| `apps/server/src/infrastructure/spansh-exploration-target-source.ts` | Kept: physical/date/signal filters and absent-versus-zero normalization are provider contracts. |
| `apps/server/src/infrastructure/spansh-faction-presence-source.ts` | Kept: nested faction evidence applies all criteria to the same presence; flattening filters would alter meaning. |
| `apps/server/src/infrastructure/spansh-material-trader-source.ts` | Kept: narrow typed delegation to shared station search. |
| `apps/server/src/infrastructure/spansh-outfitting-search-source.ts` | Kept: provider freshness, pad union and module selection preserve bounded completeness. |
| `apps/server/src/infrastructure/spansh-search-client.ts` | Kept: provider envelope normalization and rejected field-value promises require explicit validation/recovery. |
| `apps/server/src/infrastructure/spansh-shipyard-search-source.ts` | Kept: exact ship rows, null stock information and pad-filtered branches. |
| `apps/server/src/infrastructure/spansh-station-lookup-source.ts` | Kept: optional reference/distance/type/pad semantics must remain independent. |
| `apps/server/src/infrastructure/spansh-station-record.ts` | Kept: shared unknown-record mapping and named services prevent parallel station normalization. |
| `apps/server/src/infrastructure/spansh-station-search.ts` | Kept: bounded pad union sorting/deduplication and defensive pad checks protect provider completeness. |
| `apps/server/src/infrastructure/spansh-station-service-source.ts` | Kept: service-specific narrow delegation, no duplicated mapper. |
| `apps/server/src/infrastructure/spansh-system-search-source.ts` | Kept: verified provider population syntax plus local inclusive recheck; unreported population is not zero. |
| `apps/server/src/infrastructure/sqlite-commander-equipment-repository.ts` | Kept: schema parse at stored-data boundary and trusted fixed table names; no nested-query/join candidate. |
| `apps/server/src/infrastructure/sqlite-commander-log-repository.ts` | Kept: historical rebuild migrations versus later retained-data migration are intentional; ordering deterministic. |
| `apps/server/src/infrastructure/sqlite-database.ts` | Changed A2: one external-document migration helper for versions 12/14/15; separate transactions, NULL selection, version order and rollback unchanged. Other SQL aggregates/filters/orders retained. |
| `apps/server/src/infrastructure/sqlite-engineering-project-repository.ts` | Kept: CASE priority ordering and secondary stable ID are intentional; JSON validation protects retained state. |
| `apps/server/src/infrastructure/sqlite-saved-galaxy-query-repository.ts` | Kept: atomic document migration and storage-version markers; no safe SQL join simplification. |
| `apps/server/src/infrastructure/stored-cartography-observation.ts` | Kept: unknown legacy shape normalization, old semantic flags and schema validation are necessary migration boundaries. |
| `apps/server/src/infrastructure/writable-agent-profiles.ts` | Kept: refresh shipped operational instructions while retaining user character text intentionally. |
| `apps/server/src/main.ts` | Kept: ready-file identity, stdin/signal shutdown and default host traced for A1. |
| `apps/server/src/phoenix-application.ts` | Kept: composition-root length is assembly, not a defect; explicit null disables optional sources and lifecycle order matters. |
| `apps/server/src/qrcode-browser.d.ts` | Kept: narrow ambient type compatibility only. |
| `scripts/catalogue/build-experimental-effects.mjs` | Kept C6: repeated audited missing-component correction is unreachable after prior repair, but single cosmetic deletion not promoted; fail-closed recipe drift validation retained. |
| `scripts/catalogue/build-galactic-atlas.mjs` | Kept: deterministic upstream atlas normalization and region coordinate evidence. |
| `scripts/catalogue/build-personal-equipment-catalogue.mjs` | Kept: exact equipment identities, recipe/support transformations and upstream validation are source boundaries. |
| `scripts/catalogue/refresh.mjs` | Kept: refresh manifests, per-source metadata, lock ownership and canonical module selection; not one generic import path. |
| `scripts/catalogue/select-journal-module-rows.mjs` | Kept: exact EDID identity and journal-name preference prevent collision regressions. |
| `scripts/dev.mjs` | Kept: package prebuild and child lifecycle explicit; no shell/generic runner refactor. |
| `scripts/diagnostics/browser-session-soak.mjs` | Kept: isolated-origin constraint, bounded CDP requests and forced-GC samples; no live browser execution in this audit. |
| `scripts/diagnostics/isolated-browser-preview.mjs` | Kept: in-memory/no-Elite/no-provider/recording-input fixture and shutdown handlers protect user state. |
| `scripts/package/build-linux-deb.mjs` | Kept: native-platform gate and explicit staging tree; no distribution build run. |
| `scripts/package/build-payload.mjs` | Kept: scoped output deletion, deterministic checksums and pinned runtime/package licences; no generic walker extraction. |
| `scripts/package/build-windows-installer.mjs` | Kept: native x64 gate, explicit compiler invocation and unsafe-template-value rejection. |
| `scripts/package/launcher.mjs` | Changed A1: accept only expected-port localhost equivalent to internal IPv4 readiness URL, retaining ready marker, PID and HTTP checks. |
| `scripts/package/smoke-test-payload.mjs` | Kept: explicit environment isolation, retained-data/migration/corruption recovery and confirmed child exit before sandbox deletion. |
| `scripts/package/verify-linux-deb.mjs` | Kept: temporary extraction and metadata/payload/smoke verification; native installer not rebuilt here. |
| `scripts/package/verify-payload.mjs` | Kept: checksum and mandatory licence/runtime/resource checks; input is local build output, not remote manifest. |
| `scripts/package/verify-windows-installer.mjs` | Kept: native installer/uninstaller verification and scoped temporary cleanup; no Linux claim of Windows acceptance. |
| `vitest.config.ts` | Kept: one explicit shared setup registration. |
| `tests/credits-page.test.tsx` | Kept: source attribution markup assertions cover bundled/live/optional sources. |
| `tests/dashboard-command-controls.test.tsx` | Kept: real button handlers call only intended actions; renderer unmounted and docking stays unavailable. |
| `tests/dashboard-controller.test.tsx` | Kept: delayed initial evidence and obsolete failures cannot overwrite live/newer refreshes; fake event lifecycle explicit. |
| `tests/dashboard-page.test.tsx` | Kept: loading/error/accessibility and informational market-row assertions; renderer interaction cleanup present. |
| `tests/dashboard-view-model.test.ts` | Kept: commander/ship/route formatting and twenty-entry chronological presentation. |
| `tests/deskplane-route-synchronization.test.ts` | Kept: programmatic movement feedback and unknown workspace rejection. |
| `tests/desktop-workspace-routing.integration.test.tsx` | Kept: actual DesktopWorkspace/router composition and one navigation per genuine gesture; explicit fake platform. |
| `tests/developer-actions-api.test.ts` | Kept: isolated recording backend proves shared action/lease/navigation/deck APIs without real input. |
| `tests/developer-page.test.tsx` | Kept: small placeholder primitive presentation test, not proof of developer workspace completeness. |
| `tests/elite-destination-service.test.ts` | Kept: delayed holds, fresh map/route confirmation, binding diagnosis failures and no-input preflight cases are safety regressions. |
| `tests/elite-inventory-file-source.test.ts` | Kept: temporary files prove deduplication and retry-after-listener-failure; source stopped before directory removal. |
| `tests/elite-journal-file-source.test.ts` | Kept: partial writes, rotation, latest-file startup, retry and durable backfill checkpoints; scoped fixtures. |
| `tests/elite-journal-integration.test.ts` | Kept: current runtime versus historical backfill authority and durable mission projection through HTTP; lifecycle cleanup. |
| `tests/elite-journal-projection-pipeline.test.ts` | Kept: resume only failed projection and reject different event while recovery pending. |
| `tests/elite-navigation-route-file-source.test.ts` | Kept: diagnostics persist failed projection and unchanged route can retry. |
| `tests/elite-navigation-route.test.ts` | Kept: exact journal-to-route normalization fixture. |
| `tests/elite-source-diagnostics-api.test.ts` | Kept: absent Elite paths are honest diagnostic evidence, not synthetic live state. |
| `tests/elite-status-file-source.test.ts` | Kept: replaced status files, dedupe and Proton explicit path discovery; temporary source cleanup. |
| `tests/elite-status-integration.test.ts` | Kept: startup Status.json projection and diagnostics through application/API. |
| `tests/elite-status-parser.test.ts` | Kept: unsigned high bit and current Flags2 prevent signed-overflow regressions. |
| `tests/engineering-controller.test.tsx` | Kept: view-focused queries and warm snapshot revisit refresh behavior. |
| `tests/engineering-page.test.tsx` | Kept: empty numeric drafts, invalid submissions, exact effect/module identity and typed route/table presentation. |
| `tests/engineering.test.ts` | Kept: imported catalogue plus live inventory, requirements/watchlist and restart persistence; separate blueprint/experimental steps. |
| `tests/exobiology-view-model.test.ts` | Kept: journal-backed signal/sample progress, manual completion and linked body/system destinations. |
| `tests/experimental-effects-import.test.mjs` | Kept: exact variants, canonical materials, fail-closed invalid recipes and audited-cost drift. |
| `tests/exploration-body.test.ts` | Kept: local scan/sample plus current-location authority and honest no-body result. |
| `tests/exploration-data.test.ts` | Kept: ledger order/totals and manual correction separate from journal evidence. |
| `tests/exploration-target-search.test.ts` | Kept: provider filter encoding, missing-versus-zero signals, cache namespace isolation and inclusive physical bounds. |
| `tests/faction-state-search.test.ts` | Kept: OR states on the same presence, control/influence filters and optional faction-name MCP usage. |
| `tests/fixtures/fleet-fixture.ts` | Kept: typed reusable active ship and complete stored-module fixture; no stateful external dependency. |
| `tests/fleet-controller.test.tsx` | Kept: query only active family and refresh retained data on event; renderer cleanup. |
| `tests/fleet-page.test.tsx` | Kept: feature-owned routes, special vessel widgets, missing snapshots and device view persistence. |
| `tests/fleet-view-model.test.ts` | Kept: live capacity, raw identifiers, stored-module provenance and transfer formatting. |
| `tests/fleet.test.ts` | Kept: stored/live fleet authority, reject older backfill and mark module mutations partial instead of guessing. |
| `tests/frontend-backend.test.ts` | Kept: fake sources cover query endpoints/suggestions via real client/server; no external provider network. |
| `tests/frontend-ownership-boundary.test.ts` | Kept: architecture guard on sibling imports and raw routing/storage/event-stream ownership. |
| `tests/fullscreen-navigation.test.tsx` | Kept: fullscreen/F13 synchronized action semantics and no route href. |
| `tests/galactic-atlas.test.tsx` | Kept: physical region/zoom mathematics, pointer capture/drag/pinch/cancel and bookmark coordinate dedupe; native acceptance separately required. |
| `tests/galaxy-bookmarks-api.test.ts` | Kept: full CRUD for systems and stations through isolated real API. |
| `tests/galaxy-bookmarks.test.ts` | Kept: normalized target identity, system distinction, tag normalization and deterministic sort/time. |
| `tests/galaxy-controller.test.tsx` | Kept: live route cancels old fetch, matching cartography updates and focused biological refresh. |
| `tests/galaxy-map-binding-diagnostics.test.ts` | Kept: either camera slot, modifier ordering, controller exclusion and malformed XML regressions. |
| `tests/galaxy-page.test.tsx` | Kept: delayed edit/reset/unmount guards, obsolete failures, StrictMode runs, saved/follow origins and schematic plot/navigation behavior. |
| `tests/galaxy-query-catalogue.test.ts` | Kept: optional station filters, fractional gravity, unique query identities and canonical choices. |
| `tests/galnet.test.ts` | Kept: official API mapping and explicit stale offline fallback. |

## Approved changes and proof

Supplemental coverage: `.github/workflows/payload.yml` fully read separately from the 113-file code inventory. Kept: manual dispatch only, read-only repository permission, native Linux/Windows matrix, pinned Node, explicit check/build/verify/smoke ordering and seven-day installer-only artifacts. No workflow was dispatched and GitHub quota/native Windows availability were not re-verified.

## Supplemental compiler/package/config review

Full-file reads outside the original executable-code inventory, retained unchanged:

| File | Disposition |
| --- | --- |
| `tsconfig.json` | Root project references; package script order remains the supported complete build. |
| `apps/server/tsconfig.json` | Strict NodeNext project, package references, declaration output; source aliases limited to PHOENIX packages. |
| `apps/storybook/tsconfig.json` | Strict separate no-emit Storybook typecheck; includes stories/config and intentionally skips library declarations. |
| `apps/web/tsconfig.json` | Strict no-emit Bundler/DOM project and contracts reference; Vite build alone is not a typecheck. |
| `packages/contracts/tsconfig.json` | Strict composite NodeNext JS/declaration output. |
| `packages/copilot/tsconfig.json` | Strict composite NodeNext, contracts project reference. |
| `packages/elite/tsconfig.json` | Strict composite NodeNext, contracts project reference. |
| `packages/ui/tsconfig.json` | Strict no-emit Bundler/DOM package; source-consumption contract intentional. |
| `package.json` | Private workspaces; check runs typecheck, tests, build; explicit foundational package prebuild ordering. |
| `apps/server/package.json` | Private server entry, compiled exports; Control Deck and LLM client are pinned local tarballs, not source-tree aliases. |
| `apps/storybook/package.json` | Separate no-telemetry Storybook scripts/typecheck; omitted from root production check intentionally noted as scope limitation. |
| `apps/web/package.json` | Vite build and separate compiler check; pinned Control Deck runtime; real React/Deskplane composition dependencies. |
| `packages/contracts/package.json` | Compiled JS/types exports; runtime Zod and pinned Control Deck contract dependency. |
| `packages/copilot/package.json` | Compiled JS/types exports, pinned local LLM archive and contracts dependency. |
| `packages/elite/package.json` | Compiled JS/types exports and contracts/Zod normalization dependencies. |
| `packages/ui/package.json` | Source TS/CSS exports, private bundler-only UI; React peer ownership intentional. |
| `.nvmrc` | Selects Node major 24; root engines and CI specify the stricter minimum/exact 24.14.0. |
| `scripts/package/windows/phoenix.iss` | Native x64 user-local install, launcher mutex, stop-before-uninstall and scoped payload files; no install dispatch. |
| `apps/storybook/.storybook/manager-head.html` | Static icon only; no executable logic. |
| `apps/storybook/.storybook/preview-head.html` | Static icon only; no executable logic. |

Already in the parent's executable inventory, additionally read for build trace: `apps/web/vite.config.ts`, `apps/storybook/.storybook/main.ts`, `apps/storybook/.storybook/preview.tsx`. Vite forwards the actual proxy client address rather than trusting a supplied forwarded header, deduplicates React and introduces no cross-repository alias. Storybook uses the real shared UI styles. No tracked `.npmrc` exists.

Guarantees/limitations (not authorization to change compiler flags): all production projects use `strict`, but do not enable `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`; removing unknown/index/property guards is therefore not compiler-proven. Tests are outside compiler includes and Vitest transpilation is not test typechecking. Storybook checks are separate from the root production check. Engine requirements are declared but there is no tracked npm engine-strict policy. These boundaries justify retaining runtime validation, not globally adding stricter flags during this audit.

## Supplemental cross-review

Read-only inspection of the other accepted application/Elite/frontend diffs found no concrete behavior regression: raw journal-ID predicates are identical; equipment normalization already lowercases before the removed camel-case expression; module multiplicities preserve ambiguous repair invalidation; watchlist derives missing after aggregation; macro timers remove abort listeners on successful waits; inventory payload parsers already validate their return schema; shell undefined/default handling and information feature keys preserve prior behavior; Copilot control checks retain navigation exclusion and game-action-only state mutation.

`tests/frontend-information-composition.test.tsx` was fully read. It mocks the shell to return null and creates separate static renders: it proves element keys/props and defaults, **not actual component mount preservation**. Recommended bounded additional public-App composition test: render a shell stub containing the real information subtree, use feature-module stubs with effect mount/unmount counters and stable instance IDs, update Galaxy selection within a view (preserve instance), change Galaxy view/Fleet full href (remount), and leave/return the information workspace (unmount/revisit). No frontend test was edited by this reviewer.

Follow-up: fully read the resulting `tests/frontend-information-lifetime.test.tsx`. It mounts the public App with a shell stub rendering its information subtree and feature probes with effect mount/unmount IDs. It checks same-view Galaxy selection preserves the mounted instance, view/Fleet href changes remount, controls leave/revisit unmounts/remounts, and final renderer teardown removes the router listener. This resolves the reported characterization gap for App-owned mount identity; it is not a real Deskplane/browser acceptance claim.

### A1 — installed readiness rejected the application's own default URL

Before this audit, `PhoenixApplication` defaulted to `0.0.0.0`; `serverAccessUrls` deliberately advertised its local URL as `http://localhost:PORT`; `main` emitted that value in the child readiness file. The launcher probed IPv4 loopback but also required an exact `127.0.0.1` ready-file line. That invalid defensive invariant rejected healthy default/wildcard startup. The payload smoke explicitly uses IPv4 and did not expose it.

Changed only the accepted local readiness line: expected port on IPv4 loopback **or its localhost equivalent**. Retained first-line ready marker, positive integral PID, child PID/liveness, expected port and independent IPv4 HTTP probe. No arbitrary host acceptance or URL fallback. Added launcher tests for both advertised local hosts, wrong port, foreign host and wrong PID; existing foreign-service rejection remains.

### A2 — repeated external cartography migrations

Original `sqlite-database.ts` had identical external-document transformations for schema versions 12, 14 and 15. Each selected non-NULL external documents, normalized them through the same current schema/upsert, then recorded its own marker inside its own transaction. Local migration 13 occurred between 12 and 14. Three copies made rollback/normalization maintenance unnecessarily error-prone.

Extracted one private `migrateExternalCartographyDocuments(version: 12 | 14 | 15)` and retained the exact call order 12 → 13 → 14 → 15. Marker lookup/insertion now uses bound parameters. Preserved per-version BEGIN IMMEDIATE/COMMIT/ROLLBACK, source timestamp, source normalization, selected row cardinality, local columns retained by upsert, and propagation of corrupt-data errors. No transaction coalescing, new joins, filters, or historical migration removal.

Added `tests/cartography-migrations.test.ts` **before** changing production: seven tests passed against the original implementation. They cover partial applied versions 12/14/15, external-plus-local and local-only records, corruption after one successful row write with rollback and absent markers, and migration 12 committed before corrupt local migration 13 fails (14/15 remain unapplied). The same tests pass after extraction.

## Candidates deliberately kept/deferred

- C3: quick navigation construction briefly overrides a generated game-action target. Small, startup-only and contained; changing helpers would be cosmetic without measurable maintenance benefit.
- C4: conversation records may be cloned after JSON parsing. Ownership boundaries, public callers and queued mutation need explicit isolation; removing clones on sight is not justified.
- C5: HTTP server is large, but route branches encode endpoint-specific authentication, validation, response shape and SSE lifecycle. Future decomposition should be separately bounded by feature contracts, not a generic dispatcher introduced during cleanup.
- C6: one experimental-import audited recipe correction is repeated after an earlier repair. A single unreachable cosmetic assignment was not promoted over data-boundary work.
- SQL elsewhere: no nested-query/direct-join simplification was warranted. Local-traffic SUM(CASE...) aggregates intentionally cover a different scope from filtered messages; moving filters would change totals. CASE ordering, secondary IDs, NULL checks, per-version migrations and retained-data validation remain.

## Validation evidence

- Before A2 production extraction: `npx vitest run tests/cartography-migrations.test.ts` — **7/7 passed**.
- After both approved changes: `npx vitest run tests/cartography-migrations.test.ts tests/cartography.test.ts tests/package-launcher.test.ts tests/server-access-urls.test.ts` — **27/27 passed**.
- All 44 executable assigned test files plus the four focused migration/launcher/URL test files — **48 files / 192 tests passed**. `git diff --check` clean.
- Scope limitations: no native Windows installer acceptance, live Elite input, remote provider requests, or distribution rebuild was performed by this reviewer. Full integration/type/build checks belong to the parent pass.
