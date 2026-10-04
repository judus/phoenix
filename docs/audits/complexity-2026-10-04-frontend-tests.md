# Additional frontend and Copilot baseline test audit — 2026-10-04

Baseline: `95b502a`. This supplemental assignment covers alphabetically sorted tracked top-level test indices 0–43, inclusive: **44 fully read files**, from `app-routing.test.ts` through `copilot-voice-provider.test.tsx`. It does not imply that unassigned tests or every production caller were reviewed. Batches exceeding the available output budget were excluded and reread in smaller chunks.

This ledger complements [the application/domain audit](complexity-2026-10-04-application.md), which records its own 208-file inventory and approved changes. Existing test assertions/fixtures are retained: no independent behavioral refactor or broad test-helper extraction was selected. The capability tests include the individually approved A2 regressions described there.

## Dispositions

- Repeated fixtures/stub construction differ intentionally across identity, availability, cache, transport and cancellation scenarios. A generic fixture rewrite would reduce local repetition but obscure the invariants being tested; not selected without a specific maintenance benefit.
- Some older renderer tests (for example button editing and control hold-to-arm) do not explicitly unmount every created renderer. This is test-hygiene hardening, not proof of a production defect. Deferred rather than bundled into behavior-preserving source simplification.
- HTTP/SSE integration tests use temporary in-memory applications and cancel readers/stop applications in finalizers. Their explicit input/stream guards are not redundant merely because normal fixtures are valid.
- Copilot voice tests explicitly cover late microphone completion, obsolete connection attempts, live-event versus stale-snapshot ordering, and revisioned remote intent. Preserve these protections when extracting lifecycle code.

## Separate engineering-loader cross-review

Fully read the changed `use-engineering-controller.ts`, existing `engineering-controller.test.tsx` and new `engineering-request-order.test.tsx` as supporting evidence outside this 44-file inventory. Private exhaustive request selection preserves route-specific API order, signal forwarding and existing mount/cache/error/abort guards. Seven new tests cover the four projects-first branches, synchronous primary/secondary failure and asynchronous rejection; existing tests cover focused query selection and cached revisits. No concrete regression blocker found. An explicit late-aborted-response regression would be useful future hardening, but is not required to characterize the private selection extraction.

## Validation boundary

This supplemental pass is a source/test review, not a new claim that all 44 tests were run in isolation. The A2 tests ran successfully in the application audit's focused validation; parent owns final full-suite/typecheck/build/package validation. No external provider/game input, live data mutation, commit or push was performed.

## Exact file ledger

| File | Disposition and evidence |
| --- | --- |
| `tests/app-routing.test.ts` | Retain; fully read. Canonical parse/generate, retained queries, aliases and display-page exhaustiveness. |
| `tests/application-paths.test.ts` | Retain; fully read. Development/XDG/Windows installation roots and explicit overrides. |
| `tests/blueprint-symbol-resolution.test.ts` | Retain; fully read. Canonical blueprint symbols and project recipe identity survive name collisions. |
| `tests/bookmarks-page.test.tsx` | Retain; fully read. Station identity, editing, tag/notes filtering and canonical execution route. |
| `tests/breadcrumbs.test.tsx` | Retain; fully read. Shared breadcrumb separators and canonical markup. |
| `tests/browser-device-preferences.test.ts` | Retain; fully read. Versioned browser defaults/migration; unversioned legacy data is rejected. |
| `tests/browser-phoenix-router.test.ts` | Retain; fully read. Typed query routes, workspace memory, notification once and listener unsubscribe. |
| `tests/browser-snapshot-cache.test.ts` | Retain; fully read. Per-API bounded snapshot LRU and default query-draft preservation. |
| `tests/button-editor.test.tsx` | Retain; fully read. Shared placement/command labels/colors and dangerous confirmation defaults. |
| `tests/cartography.test.ts` | Retain; fully read. Provider/local aggregation, migrations, deduplicated in-flight lookups and organic evidence. |
| `tests/catalogue-module-selection.test.mjs` | Retain; fully read. Canonical module choices and explicit ambiguity refusal. |
| `tests/catalogue-snapshot-loader.test.ts` | Retain; fully read. All catalogue loaders reject missing data instead of implicitly inventing fallback. |
| `tests/catalogue-snapshot-refresh.test.ts` | Retain; fully read. Offline bundled seed and retained stale snapshots on refresh failure. |
| `tests/catalogue-suggestions.test.ts` | Retain; fully read. Canonical Elite/Spansh vocabulary, ranking, ambiguity and cache expiry/retry. |
| `tests/command-catalogue-propagation.test.ts` | Retain; fully read. Immutable catalogue revision published only after successful persistence. |
| `tests/command-foundation.test.ts` | Retain; fully read. Stable command identities and execution permission distinct from macro risk. |
| `tests/command-tile.test.tsx` | Retain; fully read. Compact tile bindings preserve full accessible context. |
| `tests/commander-equipment.test.ts` | Retain; fully read. Chronological observed equipment ownership, purchases/sales/upgrades and loadouts. |
| `tests/commander-log-page.test.tsx` | Retain; fully read. Bounded player log pagination/filter/subscription and LOG versus DEV ownership. |
| `tests/commander-log.test.ts` | Retain; fully read. Journal milestone/grouping/session identity, replay idempotence and quiet snapshots. |
| `tests/commander-page.test.tsx` | Retain; fully read. Typed commander sections and honest loading/error/observed inventory. |
| `tests/commander-view-model.test.ts` | Retain; fully read. Raw rank precision and explicit unknown/provenance values. |
| `tests/comms-controller.test.tsx` | Retain; fully read. Focused communications refresh and obsolete-request abortion. |
| `tests/comms-page.test.tsx` | Retain; fully read. Communications provenance, unknown presence and stale GalNet fallback/radio order. |
| `tests/communications.test.ts` | Retain; fully read. Inbox/traffic classification, observed contacts and durable idempotence. |
| `tests/compact-binding-label.test.ts` | Retain; fully read. Binding order and ordinary name preservation. |
| `tests/control-deck-elite-destination-input.test.ts` | Retain; fully read. Semantic Elite destination bindings and precondition/conflict refusal before simulated input. |
| `tests/control-deck-runtime-boundary.test.ts` | Retain; fully read. Control Deck package export/licensing ownership boundaries. |
| `tests/control-layout-presets.test.ts` | Retain; fully read. Custom versus PHOENIX layout geometry and placement targets. |
| `tests/controls-page.test.tsx` | Retain; fully read. Editable command selection and pointer hold-to-arm safety; quick-access routes without input. |
| `tests/controls-reconstruction.test.tsx` | Retain; fully read. Authoritative deck configuration and shared tile observed state. |
| `tests/copilot-capabilities.test.ts` | Retain; fully read. A2 regression: one current policy read, no read for navigation-only/empty catalogues, macro-only semantics. |
| `tests/copilot-chat-api.test.ts` | Retain; fully read. Buffered/streamed Copilot HTTP requests, request trimming/validation and disabled configuration. |
| `tests/copilot-client-identity.test.ts` | Retain; fully read. Browser identities work outside secure contexts and use crypto when available. |
| `tests/copilot-conversation-events.test.ts` | Retain; fully read. New turn cancels old client turn; explicit cancellation clears live activity. |
| `tests/copilot-conversation-sync.test.ts` | Retain; fully read. Shared streamed/transcript conversation events and cancellation of stream readers. |
| `tests/copilot-core.test.ts` | Retain; fully read. Protected agent prompt scaffolding, profile path safety and typed runtime/client delegation. |
| `tests/copilot-markdown.test.tsx` | Retain; fully read. GFM rendering escapes raw HTML rather than executing it. |
| `tests/copilot-outfitting.test.ts` | Retain; fully read. Canonical outfitting names, built-in component omission and honest unknown/truncation. |
| `tests/copilot-page.test.tsx` | Retain; fully read. Conversation-first compact chat and protected profile editor presentation. |
| `tests/copilot-realtime.test.ts` | Retain; fully read. Shared Realtime profiles/tools/state/persistence and public structured usage errors. |
| `tests/copilot-voice-connection-state.test.ts` | Retain; fully read. Stale voice coordinator commands and cancelled microphone attempts cannot win. |
| `tests/copilot-voice-host.test.ts` | Retain; fully read. Armed remote host intent/revision reconciliation and explicit unavailable host failure. |
| `tests/copilot-voice-provider.test.tsx` | Retain; fully read. Late microphone resolution stops tracks; stale snapshots lose to live events; device preference ownership. |

