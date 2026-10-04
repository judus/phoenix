# Complexity and defensive-programming audit — 2026-10-04

Baseline: PHOENIX `95b502a`, clean `main`, with `origin/main` aligned. This audit follows callers, runtime boundaries, normalization and temporal invariants before selecting changes. It is not a blanket guard-removal or line-count exercise. The independent Control Deck repository and pinned vendor runtime are unchanged.

Subsequent disposition: the audit was committed as `1521f56` at the user's request, before removing the unused Storybook workspace. The file inventories and Storybook evidence below describe the audited baseline, not a requirement to retain or recreate Storybook. After retirement, all 182 test files / 781 tests and production typechecks/builds still pass; future visual acceptance uses the actual PHOENIX workspace.

## Scope and review ledger

The baseline executable inventory contains 679 tracked TS/TSX/JS/MJS/CJS/SQL files, including tests, Storybook and build scripts. Supplemental review includes styles, HTML, compiler/package configuration, the Windows installer template and CI workflow. Generated output, third-party runtime internals, binary assets, catalogue contents and historical/local context archives are not claimed as audited source. Generated atlas geometry is checked as a data/provenance artifact, not manually validated coordinate by coordinate.

File-by-file dispositions, candidate proofs and characterization evidence are recorded in:

- [Application and domain](complexity-2026-10-04-application.md)
- [Infrastructure, SQL, packaging and compiler/package guarantees](complexity-2026-10-04-infrastructure.md)
- [Contracts, Elite ingestion and Copilot core](complexity-2026-10-04-core.md)
- [Frontend, shared UI and Storybook](complexity-2026-10-04-frontend.md)
- [Supplemental frontend test review](complexity-2026-10-04-frontend-tests.md)
- [Styles and HTML](complexity-2026-10-04-styles-config.md)

Final reconciliation against `git ls-tree 95b502a` accounts for all 679 baseline executable-source/configuration/test paths, with no missing or pending dispositions. Of these, 678 were fully read; the generated atlas coordinate file received provenance/structural review and complete numeric validation instead. The ledgers also cover 83 distinct supplementary style/HTML/configuration paths; the CI workflow is reviewed in the infrastructure narrative. Delegated test rows point to their completed companion ledger rather than claiming a second full read. Newly added regression files and every production diff were also reviewed.

## Proven simplifications

| Candidate | Change | Invariants retained |
| --- | --- | --- |
| Core P1 | Remove repeated inventory wrapper validation after canonical payload parsing. | Unknown raw input and canonical payload validation, defaults, normalization, dispatch errors and input immutability. |
| Application A1 | Reuse the identical safe nonnegative integer predicate for organic body IDs. | Raw journal fields remain checked, including zero, invalid numeric values and non-numbers. |
| Application A2 | Read one current capability policy per control-tool visibility check. | No cross-call policy cache; empty/navigation-only catalogues do not read settings; switch-state tools require game actions; execution rechecks remain. |
| Application A3 | Remove an unreachable uppercase-boundary regex after lowercase normalization. | Existing fallback labels and localized-name precedence. |
| Application A4 | Count normalized module-ID multiplicities once instead of scanning all modules for every target. | Ambiguous installations remain unknown; unrelated modules and the all-module branch retain their behavior. |
| Application A5 | Model the intermediate watchlist aggregate without a fabricated `missing: 1`. | The final derived deficit, aggregation, positive-only filter, priority, ordering and public schema. |
| Infrastructure A2 | Share identical cartography migrations 12/14/15 through a version-restricted helper. | Separate transactions and markers, call order around migration 13, local-only rows, retained local columns and corrupt-data rollback. |
| Frontend F1 | Replace seven-section nested selection chains with exhaustive private route helpers. | React component boundaries, feature keys, selected IDs and workspace mount lifetimes. |
| Frontend F2 | Forward optional shell props directly instead of ten conditional object spreads. | Child defaults, empty strings, stable empty arrays and the empty-label fallback. |
| Frontend F3 | Select Engineering requests through a private non-async view switch. | Projects-first API initiation, synchronous exceptions versus rejected promises, route narrowing, cache ownership and cancellation guards. |
| Frontend F4 | Use canonical `MacroStep` editor state instead of unreachable legacy command variants and fabricated flags. | Exact saved fields, zero-duration waits, tap/press/release operations, trimming, deletion, debounce, serialization and source immutability. |

Two narrow defects were also corrected with regression evidence: default installed startup rejected the application's own `localhost` readiness advertisement (Infrastructure A1), and completed macro waits retained abort listeners (Application A6). The first still requires the expected port, process identity/liveness and HTTP health. The second still rejects the exact abort reason and leaves held-action cleanup intact. These are identified as fixes, not misrepresented as strictly behavior-neutral rewrites.

## Complexity deliberately retained

- SQL inspection did not justify a derived-table/subquery-to-JOIN rewrite. Aggregate scopes, CASE ordering, NULL semantics, stable IDs and migration transactions are meaningful.
- HTTP validation is not proof for services also called by MCP, direct composition or retained-data readers. Provider responses, saved queries and raw journal fields remain runtime boundaries.
- Optional telemetry is genuinely unknown, not malformed required state. Duplicate module identities and incomplete system hierarchies must not be guessed.
- Cancellation, request identity, revisions, file-read serialization and journal byte-offset checks protect events that occur after earlier validation; checking once at entry is insufficient.
- Cloning at public store/repository boundaries protects ownership. Alias maps deduplicate catalogue names; direct arrays would change duplicate selection and lookup behavior.
- Large HTTP/application files were not rewritten into generic dispatch frameworks solely because of their length. Public planner checks remain domain rules, not redundant form validation.

## Follow-ups requiring separate behavior decisions

1. Macro finalization can leave `activeRun` set if releasing held actions rejects. Production activity persistence/listeners can throw after input dispatch. A future fix must report uncertain input/cleanup outcomes without blindly retrying side effects; see Application D1.
2. Personal-equipment preview request ordering and some dashboard bootstrap callbacks need dedicated cancellation/latest-result tests before changing state behavior; see the frontend ledger.
3. Engineering catalogue grade-map keys are weaker than their values. Tightening accepted keys requires an explicit catalogue compatibility/migration decision; see Core P3.
4. Form controls and Elite tiles suppress keyboard focus outlines without a replacement. This is existing accessibility behavior, not a redundant guard; a separate visual/accessibility change needs keyboard/browser proof; see Styles S1/S2.

## Validation and limitations

Final validation on the completed production changes:

- `npm run check`: 182 test files / 781 tests pass, plus production typechecks and builds. This adds 54 tests over the 727-test baseline. The detailed ledgers distinguish pre/post-refactor characterization from tests added afterward.
- Separate Storybook typecheck and static build pass. Existing unresolved-at-build favicon and large-chunk warnings remain; no styling changes were made.
- `npm run installer:linux` and `npm run installer:linux:verify` pass: 80 payload checksums, read-only installed startup, single-instance handling, clean shutdown, isolated writable state, retained data, settings migration and corrupt-settings refusal/recovery.
- Linux artifact: `dist/installer/phoenix_0.1.2_amd64.deb`, SHA-256 `807f378d2eafb1f6aa99962078808989a3f208f730bc76167d0fc528ee8153a3`.
- `git diff --check` passes. Control Deck and the pinned runtime remain unchanged. At audit completion, no commit or push had been requested or performed; the subsequent authorized audit commit is recorded above. No push was requested.

No live player database, Elite input, external provider query, production server restart, native Windows install or GitHub Actions dispatch is used by this audit. Extracted installed-mode verification is not a system-wide install/uninstall test. Unit/isolated transport tests do not prove physical-tablet or live-game behavior. Vitest transpiles tests; production compiler checks do not typecheck the test suite. Generated/binary/catalogue assets are outside manual source coverage as described above.
