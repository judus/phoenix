---
name: phoenix-release
description: Prepare or verify PHOENIX CI, dev-to-main promotion, installers and prerelease publication. Use for release work, not ordinary UI fixes.
---

# PHOENIX releases

Read [docs/releases.md](../../../docs/releases.md), relevant installation instructions and workflow
definitions. Inspect both Git state and the exact source SHA. Control Deck is an independently
owned dependency: runtime/helper versions and artifact integrity must match the intended release.

- Feature work branches from dev. Follow the documented PR promotion and main-to-dev sync workflow.
- Commit, push, PR merge, tag and publication are separate consequential actions: confirm authority
  for the requested sequence. An issue or passing local test does not authorize publication.
- Keep dependent mutations sequential and check each result. Never push a tag after a failed merge;
  verify main SHA, package version and tag validation first.
- Do not cancel a same-SHA CI run just because another run looks redundant: an always-run failed
  gate can block the protected PR. Inspect all required checks rather than bypassing protection.
- Require native Linux/Windows CI as documented. Do not claim Windows/Elite acceptance from Linux
  tests, simulated input, or a successful build alone.
- Download release assets and verify checksums plus manifests/version/source SHA before publishing.
  A draft is not a public prerelease; check draft/prerelease/latest flags and public download links.
- Preserve old releases unless removal is explicitly requested. Use stable installer asset names
  from the release guide; update README links, screenshots and CHANGELOG without inventing history.
- Keep ignored .context handoff current with actual commits, checks and remaining acceptance work.
  Never force-add it or include credentials/player data in public PR/release text.
