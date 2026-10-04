# Complexity audit follow-up — 2026-10-04

Baseline: `69a0fbe` on `main`, aligned with `origin/main` after the authorized audit and Storybook-retirement push. This pass implements the [original audit's](complexity-2026-10-04.md) proven follow-ups. It does not repeat its file inventory or treat all defensive checks as redundant. Control Deck and its pinned runtime remain unchanged.

Subsequent disposition: this pass was committed as `ea91f70` before the next authorized slice. The completion-time evidence below is historical; the [next reliability pass](reliability-2026-10-04-next-pass.md) records the recording-identity fix, Settings/Copilot ownership, measured refresh work and current release limits. At audit closure, the user authorized committing the next pass and pushing both commits beyond `origin/main` at `69a0fbe`.

## Candidate proofs and disposition

### Application D1: macro input and cleanup ownership

Trace: HTTP recording/playback and the Control Deck command adapter call `MacroService`; production `LoggedGameActions` dispatches input before activity persistence/listeners finish. Therefore a rejected promise does **not** prove that no key was pressed. Conversely, a failed release must not be blindly retried. Runtime release of an unknown lease is a no-op and does not reach the physical gateway.

Regressions established the defects before production changes: post-dispatch failures could strand a held lease; an explicit release could be attempted twice; failed finalization could leave playback locked or unlock it before another release settled. Recording has the same post-input boundary, plus overlapping press/release/stop/cancel operations.

Implemented:

- Reserve the lease before attempting a press. Renew it only after accepted input, and only while that recording still owns the pending hold.
- Consume the hold and stop its renewal before attempting a release. Cleanup never retries that release.
- Attempt every outstanding cleanup release, including when an implementation throws synchronously. Await all attempts before clearing playback ownership, preserving the first cleanup rejection.
- Clear `activeRun` even when cleanup fails. Preserve the primary failed/aborted/timed-out playback outcome and attach cleanup failure information; cleanup-only failure still rejects with the original cause.

Existing capability checks, dangerous-action confirmation, lease expiry, recording entry policy, and release-result policy remain. These are narrowly identified correctness fixes, not behavior-neutral guard removal. Automated tests exercise the real Control Deck-backed lease service but do not claim live Elite input acceptance.

### Frontend: request lifetime versus revision

Personal Equipment Planner callers can submit a new preview while an earlier request is pending; workspace deactivation, API replacement and unmount also end the request's ownership. The API supports cancellation, but cancellation alone does not establish that a promise cannot settle. Seven failing-before regressions establish these cases. The controller now uses the existing `LatestRequest` owner, passes its signal, and publishes only the current request. Options loading and preview output contracts are unchanged.

Dashboard bootstrap requests already had revision checks protecting newer live events. Those counters reset for each effect lifetime, so an old request could satisfy a replacement lifetime's counter. Five failing-before replacement-API regressions demonstrate the missing condition. The five callbacks now also require the existing effect signal to be live; the event revision checks remain necessary.

Macro recording action responses likewise require session and provider-lifetime ownership: an old action may finish after stop/cancel or a replacement recording. Its promise still settles or rejects for the calling control; it cannot recreate the old toolbar or publish an old error into a new session. Eleven initially failing action/closing cases and four further lifetime/current-behavior cases protect this boundary. A closing response also cannot clear a newer recording. Stop still saves its captured usable recording and updates the live library; it does not navigate away from a newer session. No per-action abort/latest-request mechanism is introduced: press/release are side effects, not replaceable previews. Playback is unchanged.

### Frontend: journal merge complexity

Trace: the bootstrap snapshot is merged behind live entries, filtering **only** snapshot IDs already present in the live buffer, then capped at 500. Duplicate snapshot IDs must not be globally deduplicated. Six characterization cases pass before and after, including empty buffers, duplicates and the cap boundary.

Replace one live-buffer scan per snapshot entry with a set of live IDs. Membership becomes linear in the two input lengths instead of their product, without changing ordering, duplicate selection, references or the cap.

### Core P3: validate new catalogue output, preserve retained readers

The retained engineering reader uses `parseInt` for grade keys and has longstanding acceptance of aliases, positive out-of-range grades, sparse maps and duplicate normalized recipes. Eleven pre-change characterization tests protect that contract; silently tightening its schema would reject previously readable catalogues.

The fresh producer is a different boundary: Coriolis grade keys feed both blueprint and material projections, where permissive/inconsistent numeric coercion can disagree. Validate canonical keys `"1"` through `"5"` immediately after fetching the source and before deriving or staging output. Empty/missing/sparse maps remain accepted. An invalid key gives the blueprint/key and required correction; the old snapshot remains untouched. The actual refresh-command regression uses child-local fixture fetches, not the live provider, and checks retained bytes. All bundled official grade keys pass.

No reader migration, stored catalogue rewrite or material-cost change is made. This validation cannot recover duplicate raw JSON object keys already discarded by JSON parsing.

### Styles S1/S2: keyboard focus, with real-shell acceptance

Shared inputs/selects and Elite command tiles suppressed `:focus-visible` without a replacement. Restore a flat two-pixel focus ring inside the control, avoiding input-action overflow clipping and preserving the invalid border. Elite tiles add a solid contrasting inset band, not blur, bloom or a dimensional button treatment. PHOENIX's existing tile focus treatment remains unchanged; mouse/touch styling is unaffected.

Four initially failing stylesheet contract tests cover focus, invalid borders, the duplicate stylesheet import and the watermark token. Native Tab interaction was then checked in the actual isolated PHOENIX production shell, in both themes and landscape/portrait: presentation select, reference input with inset action, multiselect, invalid input, and command tile (20 checks). Screenshots were inspected for clipping and contrast. No Storybook or alternate shell was used. This is keyboard/desktop evidence, not physical-tablet validation.

### Styles S3/S4: remove demonstrably ineffective declarations

- Remove the adjacent duplicate `traffic.css` import; the retained import supplies the identical rules once.
- Remove the Numpy watermark's reference to undeclared `--font-weight-bold`. With no fallback the old declaration was invalid and inherited the weight already; deleting it preserves that appearance rather than inventing a new token or bold treatment.

## Validation

- `npm run check` passes: 187 test files / 860 tests, production typechecks and builds. This adds 79 tests over the pushed Storybook-retirement baseline. Vitest transpiles tests; production compiler checks are not a separate test-suite typecheck.
- Independent cross-review covers macro cleanup/recording and request lifetime changes; its final macro-service/provider/page gate passes 40 tests. All production diffs and new tests were reviewed by the main agent.
- The actual isolated production shell passes 20 native keyboard focus checks as described above; temporary preview/browser processes are stopped.
- `npm run installer:linux` and `npm run installer:linux:verify` pass: 81 payload checksums, read-only installed startup, single-instance handling, clean shutdown, isolated writable state, retained data, settings migration and corrupt-settings refusal/recovery. The extra payload file is the fresh grade-key validation helper.
- Linux artifact: `dist/installer/phoenix_0.1.2_amd64.deb`, SHA-256 `ea277eadf9c3dfd5dccab2a8d7badae1919825b24c3400cec649f89ecbe63aff`.
- `git diff --check` passes. No dependency, Control Deck source or pinned-runtime changes. Follow-up fixes remain uncommitted; the preceding authorized audit/Storybook commits are already pushed.

Fresh catalogue rejection, async ownership, and macro release/finalization defects were reproduced before their production fixes; the journal and retained-reader contracts were characterized before simplification or producer validation.

## Boundaries and remaining decisions

- SQL aggregate scopes, ordering, NULL semantics and migration transactions remain as reviewed. No speculative JOIN rewrite was justified.
- Raw/provider/retained-data validation and genuinely unknown telemetry remain. No assertion that a transport guard proves every service caller was validated.
- Broader catalogue-reader tightening needs a separately chosen compatibility/migration policy; this pass validates only newly generated grade keys.
- Memoizing schematic/render data, suppressing material refetches, or splitting large services still needs profiling or a concrete ownership problem, not a shorter-file preference.
- A separate existing macro persistence risk remains: overlapping recording saves can capture the same library, choose the same `Macro N` name, derive the same slug ID, and upsert one recording over another. The trace is `nextMacroName` → `macroDefinitionFromRecording` → both repository `save` implementations. This pass fixes recording UI/hold ownership, not cross-client ID allocation or save serialization. Do not describe it as a fully serialized save workflow; a follow-up needs a failing overlap test and a deliberate allocation policy that preserves edit/upsert semantics.
- No live player database, game input, external query, live server restart, native Windows install or GitHub Actions run is used. Temporary isolated preview/browser processes are stopped after acceptance. Extracted Linux verification is not a system-wide install/uninstall test.
