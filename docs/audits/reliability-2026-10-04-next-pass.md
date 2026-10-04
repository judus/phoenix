# Reliability follow-up — 2026-10-04

Baseline: `ea91f70`, committed at the user's request before this pass. That checkpoint contains the [complexity follow-up](complexity-2026-10-04-follow-up.md); it was not pushed at the start of this pass. This pass addresses the four agreed follow-ups, not a new indiscriminate guard-removal exercise. Control Deck and its compiled runtime remain unchanged.

## 1. Recorded macro identity

Candidate: concurrent recording saves read the same library, choose the same `Macro N` display name, derive the same slug identifier and replace each other through repository upsert.

Trace: `MacroRecording.id` is already a server-issued UUID. The recording converter is used only when finalizing a recording. Editors preserve existing identifiers; repositories intentionally upsert edits; registry command targets depend on identifier stability. Therefore changing repository upsert or renaming existing macros would change unrelated behavior.

Seven failing-before regressions cover real provider → MacroService → memory/temporary-JSON repository saves, same-provider and different-client overlaps, repeat conversion, distinct recordings and existing editor/registry targets. New recordings now use `macro-${recording.id}`. Same recording identity is stable even when renamed; separate recordings cannot collide merely because their display names match. Existing saved identifiers and deliberate editing/upsert behavior are untouched. Duplicate display names remain possible; this is identity allocation, not globally serialized naming.

## 2. Settings and Copilot async ownership

Disposed reads can still settle, and authorized writes can finish after navigation, API replacement, selection changes or further edits. These require different treatment: cancel obsolete reads where supported, guard publication, but do not abort or retry writes merely because their UI owner disappeared.

Settings bootstrap results and mutation publication are API/lifetime-owned. Threshold and API-key completion preserve subsequently edited input. Pairing bootstrap cannot launch administrator reads after disposal. Genuine successful revocation/unpairing still reloads after navigation: completion changed authorization, not merely UI state, and a different API object does not establish a different installation.

Profile selection/template reads use the existing `LatestRequest`; selection revisions guard save/permission publication. A save cannot overwrite a newer selection or draft edit. When a new profile is created during further editing, the draft adopts its persisted identity and loses its creation-template flag while retaining the newer fields, avoiding a second unintended create.

Per-operation busy flags prevent one Settings save from clearing another concurrent save. Provider/permission results retain the independently updated API-key configuration; key results merge only the key state. Shared controls still disable duplicate writes through the existing `Button busy` behavior.

Voice provider cleanup now owns an API lifetime: it disposes token/microphone/socket attempts before replacement can proceed. Obsolete heartbeat/status replies cannot reconcile into a fresh connection. Retained controls cannot dispatch through a disposed API, and profile-selection replies cannot overwrite a newer live profile event. Text-stream cleanup likewise covers API replacement; noncooperative old streams cannot publish tool status or restart old history.

A second profile-editor epoch at successful editor publication protects the still-visible old editor while the next selection loads. Without this, an old-editor save/permission action could capture the new selection's start epoch and later overwrite its capabilities or clear its busy flag. The authorized old write still completes.

Failing-before batches cover Settings bootstrap/save/edit publication, profile selection/template/save/capability races, delayed voice heartbeat and token attempts, retained callbacks, chat-stream disposal, concurrent Settings saves, created-profile identity, and editor-publication overlap. Two successful authorization-reload characterizations remain green without changing their side-effect policy. The final focused Settings/profile/chat/voice gate passes 49 tests. Independent review found no blocker in this scope.

Remaining review candidates, **not reproduced defects**: realtime context/tool/persistence completions across connection turnover and coordinator intent flags on API replacement. These require side-effect tracing before any proposed cancellation, retry or broader refactor.

## 3. Measured refresh overhead

The user reports that the tablet has not crashed in recent days. This is a useful observation, not evidence identifying or resolving the old root cause. No speculative crash fix or geometry memoization is included.

The isolated production-shell browser profile uses in-memory data, blocked external fetches, simulated input and a dense fixture with 121 bodies and 40 stations. Each view receives 100 unchanged runtime events at 50 ms intervals after a quiet baseline. Before optimization, Engineering Materials, Blueprints and Engineers, and Personal Materials each issue 100 reload requests. Engineering produces 300–301 root commits versus 0–2 during quiet windows. Personal Materials produces 100 versus 2.

The dense schematic performs no cartography refetch; its 102 root commits consume approximately 0.206 s of scripting and 0.240 s of task time over 100 events. Post-GC heap rises about 295 KB while nodes/listeners remain stable. This does not establish a leak or tablet crash cause. Geometry work remains unchanged.

Dependency-aware refresh preserves every read-model input, including inventory contents and timestamps, applied modules, engineer access, position and project mutation events as relevant to each view. Timestamps alone and object identity across SSE JSON snapshots are not sufficient invariants. The keys are narrow structural serializations, not another authoritative cache or source of truth.

Server-source tracing covers category-specific material contents plus their shared observed timestamp; xeno's union of all categories; blueprint-list applied modules; blueprint-detail costs/modules/access/distance; effects and project watchlist inventory; and complete locker/backpack contents, labels, mission tags and timestamps. `engineering-projects-changed`, route/API lifetimes and request-order guards remain. Failed requests retry on a subsequent event; Engineering clears that retry flag synchronously to avoid a burst queuing in-flight retries. No healthy view gains a polling timer.

The valid fresh-document run verifies the rebuilt `/assets/index-C2BfbzJX.js` in Chrome 154.0.8037.97, the selected public headings, successful fixture endpoints, 121 rendered schematic bodies and one active event stream. Per 100 unchanged events, Engineering Materials/Blueprints/Engineers requests fall from 100 to 0 each; Personal Materials falls from 100 to 1 (conservative first-event bootstrap reconciliation). Root commits fall from 300–301 to 100 in Engineering and 100 to 1 for Personal Materials. Schematic requests remain zero, geometry unchanged.

Engineering scripting time falls approximately from 0.105–0.134 s to 0.038–0.044 s; personal-material time from 0.040 s to 0.008 s. These are noisy desktop-fixture measurements, not a tablet benchmark or a promise of fixed gameplay latency. There are no unexpected HTTP/network errors or browser exceptions. Detailed measurements and rerun instructions: [diagnostics README](../../scripts/diagnostics/README.md).

One hash-only rerun was discarded: it retained the old document/bundle and reset synthetic revisions below the runtime store's monotonic guard. The diagnostic now forces a new document and checks the actual built entry, avoiding a false zero-request result. Only within-document deltas are compared. Owned diagnostic Chrome and in-memory fixture processes were stopped.

## 4. Release evidence and remaining native acceptance

Current host is Linux x64 with Node 24.14.0. Native Windows build/verification requires Windows x64, Visual C++ build tools and Inno Setup; a Linux/Wine build is not equivalent. The user confirms earlier GitHub Actions installers worked on Windows but has no Windows test machine available now. That historical evidence does not validate this changed source or real Elite input cleanup.

The existing manual Actions workflow remains the native build path; it has not been dispatched in this pass. The previously reported account storage quota warning has not been resolved or disproven. Local native build is the documented fallback when a machine is available. Real Elite acceptance needs one known-good and one formerly failing binding plus held-input stop/cancel/failure cleanup, with the actual game focused. Automated lease tests and simulated browser input are not substitutes.

Fresh Linux build and extracted installed-mode verification pass all 81 payload checksums, read-only installation, single-instance behavior, clean stop, isolated writable state, retained data, settings migration and corrupt-settings refusal/recovery. This does not claim system-wide install/uninstall or Windows/Elite acceptance.

Artifact: `dist/installer/phoenix_0.1.2_amd64.deb`, SHA-256 `f760279a7fc8bbee998d703a7f42d34951b1dad950f8ea723ed333b0cd45ce4b`. This was built from the completed next-pass worktree, not the earlier checkpoint artifact.

## PhpStorm import report

All imports in `tests/macro-service.test.ts` resolve in a direct strict TypeScript check, together with the new macro identity/lifetime tests. No source import defect was established; no speculative import rewrite was made. Test files are outside the production compiler projects, which may affect IDE project discovery, but the exact PhpStorm diagnostic was not available.

A temporary broad test-typecheck probe found 205 diagnostics in 45 existing test files (renderer `act` return typing, incomplete/stale mocks and narrowing, among others), not in `macro-service.test.ts`. No failing gate was added and no type safety was weakened to hide that debt. Vitest transpilation plus production typechecks must not be described as a full strict test-suite typecheck. New standalone regression files are checked separately.

## Final validation

- Final `npm run check` passes: 192 test files / 919 tests, production typechecks and production builds. A subsequent full `npm test` run confirms the final count including both additional failure-recovery cases.
- Nine relevant test files pass a direct strict TypeScript check: macro service, recording identity/lifetime, Settings, profile/chat ownership, voice provider, Engineering refresh, personal-material refresh, and diagnostic cartography. No source import defect in `macro-service.test.ts` was reproduced.
- Independent cross-review covers identity, Settings/profile/chat/voice ownership and exact refresh dependencies/retry. The combined request/ownership review gate passes 80 tests; the final refresh/request-order/personal/fixture gate passes 43 tests.
- Fresh-document production-browser comparison passes as above. All owned preview/browser processes are stopped; no live user application was restarted.
- `npm run installer:linux` and `npm run installer:linux:verify` pass against the completed worktree, with the 81-checksum artifact and installed-mode checks listed above. `git diff --check` passes.
- No dependency, Control Deck source or pinned-runtime change. After audit closure, the user authorized committing this next pass and pushing it together with checkpoint `ea91f70`. Final repository status is recorded in the local handoff. Local `.context` files remain ignored, not force-added.
