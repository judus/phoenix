---
name: codebase-audit
description: Perform a systematic, evidence-backed PHOENIX codebase audit for unnecessary complexity, redundant defensive checks, and maintainability problems. Use for an explicit audit or audit follow-up, not routine edits or a mechanical cleanup.
---

# Codebase audit

Reduce accidental complexity without weakening correctness. A suspicious construct is a candidate,
not a bug. Shorter code alone is not an improvement. Review-only requests authorize investigation;
implement refactors only when the user also asks for changes. Report behavior-changing fixes
separately from behavior-preserving simplifications.

## Establish scope and evidence

1. Record the repository, baseline commit, branch, dirty work and requested scope. Read the current
   architecture/contribution guidance. Inspect Control Deck ownership when a flow crosses that
   dependency; do not modify its source or pin as an incidental PHOENIX cleanup.
2. Inventory tracked files with `git ls-files`. Review systematically, file by file, including
   relevant tests, styles, build scripts, packaging and configuration—not just search matches.
   Explicitly exclude generated output, third-party internals, binary assets and catalogue data
   from manual source coverage; check provenance/structure where relevant instead.
3. Keep a coverage ledger and candidate log in ignored `.context/audits/` (or a user-requested
   location), not in public `docs/`. Record reviewed, pending and excluded files accurately.
   Truncated output is not a complete read; revisit it in smaller chunks.
4. If delegation is authorized, split non-overlapping review scopes and require each reviewer's
   file ledger and candidate evidence. Reconcile the combined inventory and review the combined
   diff; delegation does not prove coverage or grant permission to edit.

For each candidate record: file/symbol, suspected complexity, callers and boundaries traced,
invariants, proposed change, semantic risks, disposition (keep/refactor/fix/defer), and validation.
Keep rejected candidates with the reason they are necessary. Avoid generic "reviewed" rows that
hide an unexamined concern. Do not claim completion while files or proofs remain pending.

## Understand before changing

Trace the full relevant path: callers, types, constructors/factories, deserialization, normalization,
prior validation, storage and consumers. Include HTTP, MCP/tool, background and direct-composition
callers. A check in one transport does not establish an invariant for every service caller.

Distinguish:

- Validation at raw journal/status, provider, file, database, saved-query and configuration boundaries.
- Domain rules, genuinely optional/unknown telemetry, ambiguous identities and partial snapshots.
- Internal invariants already established on **every** reachable path.
- Guards compensating for weak types, invalid intermediate states or misplaced responsibilities.

Prefer validation at ingress, but do not move it until error behavior, compatibility and all bypass
paths are understood. A TypeScript annotation is not proof that persisted or external data is valid.
Parsing can normalize, apply defaults or clone values: repeated-looking parses are not necessarily
equivalent. Retained-data acceptance must not tighten silently.

Check temporal invariants too: earlier validation does not replace cancellation, request/session
ownership, revisions, lease lifetimes or file-offset checks. Async results can outlive their owner;
rejected input dispatch can still have caused a side effect. Never blindly retry game commands.

## Candidate patterns

- **SQL:** Inspect subqueries, derived tables and nested selects. A projection-only derived table
  may become a direct JOIN, but first prove equivalent cardinality, duplicates, filtering,
  aggregation, transformation, ordering/limits and NULL behavior. Preserve outer-join predicate
  placement, migration order and transaction/rollback boundaries.
- **Control flow:** Check nested conditionals, boolean assignments and guards around empty loops.
  Prove operand types, truthiness, short-circuiting, side effects and evaluation order. Preserve
  synchronous throws versus rejected promises and meaningful defaults/fallbacks.
- **Defensive checks:** Remove guards only after proving the required state on every caller path.
  If the model permits invalid intermediate state, propose the owning boundary/type correction
  rather than deleting the symptom. Preserve unknown state instead of fabricating a value.
- **Repeated work and abstractions:** Trace normalization and identity before replacing scans with
  maps/sets. Preserve ordering and duplicate selection. Keep cloning that protects ownership.
  Do not merge different cache/freshness policies, introduce generic frameworks, split large files
  or add memoization merely to reduce line counts. Profile suspected hot paths first.

## Refactor and verify

1. Finish the candidate's wider-context proof before editing. Add characterization tests for
   simplifications; run them against the old implementation where feasible. Reproduce actual
   defects with failing regressions before fixing them.
2. Make narrow changes. Exercise boundary values, missing/unknown state, duplicates, retained data,
   cancellation/replacement and cleanup failure where the traced behavior requires them.
3. Run focused checks after each slice and `npm run check` on the combined result. Vitest execution
   plus production typechecks is not a strict typecheck of all test files; check changed test types
   separately where appropriate and report existing gaps without weakening compiler settings.
4. Validate the affected integration: use the real PHOENIX shell for UI interactions, isolated
   state for persistence, and packaged-payload smoke checks for resource/startup changes. Use
   measured before/after workloads for performance claims. Follow the packaging guide for native
   installer checks; Linux tests do not establish Windows or real Elite acceptance.
5. Do not use live player data, send game input, restart the user's app, submit external data or
   run/publish CI releases without appropriate authorization. Stop only test processes you own.

Finish with changed and deliberately retained candidates, validation results, remaining decisions
and exact coverage limits. Keep the detailed ledger local. Commit, push, merge and release remain
separate actions requiring authorization; an audit is not permission to perform them.
