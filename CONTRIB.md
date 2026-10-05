# Contributing to PHOENIX

Thank you for taking an interest in PHOENIX. Bug reports, criticism, product ideas, documentation,
tests, and code contributions are welcome.

## Before implementing

Please open or join an issue before investing substantial effort in a new feature, architectural
change, dependency, migration, or visual direction. PHOENIX is still pre-release and its foundations
may change; early discussion helps keep contributions aligned without promising that every proposal
will be accepted.

Small, clearly bounded fixes may be submitted directly. Keep each contribution focused and explain
the user-visible problem it solves.

## Issue labels and completion

- `bug`: something is broken or behaving incorrectly.
- `task`: accepted work to do. An approved bug fix can carry both `bug` and `task`.
- `feature request`: a proposed feature awaiting a maintainer decision, not an approved TODO.
- `idea`: an exploratory suggestion, not authorization to implement it.

When a request or idea is accepted, replace that label with `task` and record the agreed scope.
Rejected proposals are closed as **not planned**, with a short explanation. Use additional labels
such as `documentation` where useful; prefer these explicit categories over generic `enhancement`.

Implementation issues stay open while work is local, on a feature branch, or in an unmerged PR.
Close them as **completed** only after their full agreed scope is verified and merged into `dev`.
Include the merged PR or commit reference in the closing comment. Partial completion does not close
an umbrella issue; update its checklist instead. Promotion to `main` and release publication are
separate checkpoints, not prerequisites for closing completed development work.

Reference issues in PRs and reconcile their status at each merge checkpoint. Since `main` is the
GitHub default branch, do not rely on closing keywords to close issues when a PR merges into `dev`;
verify that merge and explicitly close the completed issues.

## Architecture and quality

- Understand the existing owner and flow before changing it. Do not add parallel implementations,
  compatibility paths, or fallback models to avoid changing the appropriate layer.
- Keep server read models authoritative and client rendering thin.
- Put reusable UI behavior in the shared UI package and Elite normalization in the Elite package;
  keep application composition and persistence in the server application.
- Control Deck remains a separately owned product and dependency. Do not copy or recreate its source
  inside PHOENIX.
- Keep schemas explicitly versionable. PHOENIX does not preserve pre-release compatibility unless a
  real retained-data migration requires it.
- Add focused tests for behavior and contracts. Do not freeze incidental pixel values in tests.
- Run `npm run check` before submitting a pull request and report any environment-dependent checks
  that could not be completed.

## Privacy and third-party material

Do not include API keys, private journal data, commander details, pairing credentials, or other user
data in issues, fixtures, screenshots, or commits.

Do not submit copied game files, unlicensed artwork, fonts, sounds, datasets, or other third-party
material without clear provenance and redistribution terms. Code contributions and external assets
have separate licensing requirements.

## Contribution licence

PHOENIX source code and documentation are licensed under the [Apache License 2.0](LICENSE). Unless
you explicitly state otherwise, a contribution intentionally submitted for inclusion in PHOENIX is
provided under the same terms, as described by section 5 of that license.

The separately licensed Control Deck runtime is not part of the Apache-licensed PHOENIX source and
must remain within its own use and redistribution terms.
