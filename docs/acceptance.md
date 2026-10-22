# PHOENIX acceptance checklist

Reviewed **2026-10-22**. Tracking task: [#25](https://github.com/judus/phoenix/issues/25).
This records evidence and outstanding tests, not a claim that every platform/gameplay check passed.
Refresh the build identity and results before each release.

## Current preview evidence: 0.1.10

[#223](https://github.com/judus/phoenix/issues/223) exposes the existing Galaxy Map routine to
Copilot through an explicit installation/profile permission. Automated tests cover all four
route outcomes, binding diagnostics, validation, cancellation, permission revocation, real MCP
dispatch with recorded/no game input, and voice execution beyond the previous 30-second limit.
The new permission is off by default. This candidate excludes the separate Android TLS experiment.
Final local `npm run check` passed 277 files / 1,758 tests, strict production/test typechecks and builds.
The isolated built browser shell shows **Plot Route** as **Game control**, initially off.

Published preview: [v0.1.10](https://github.com/judus/phoenix/releases/tag/v0.1.10), exact source
`dcbde3f03d0a2f3349b7f01141c624f9bcae8fe5`. Route implementation [PR #224](https://github.com/judus/phoenix/pull/224)
passed native source CI. Release test fixes [PR #227](https://github.com/judus/phoenix/pull/227)
passed both native source gates in [run 39741662425](https://github.com/judus/phoenix/actions/runs/39741662425).
The fixes separate Powerplay fixture startup from independent validation/persistence cases,
retaining real SQLite reopen assertions and unchanged timeouts, and make route cancellation
advance on the test's fake clock as requested by Copilot review.

Promotion [PR #225](https://github.com/judus/phoenix/pull/225) passed native installer verification
in [run 39742309334](https://github.com/judus/phoenix/actions/runs/39742309334).
Exact-tag native builds and draft assembly passed in
[release run 39743113795](https://github.com/judus/phoenix/actions/runs/39743113795).
Downloaded both installers and manifests, verified all four original SHA-256 checksums,
exact source, version, preview channel and byte counts before publication.
Both public installer downloads returned HTTP 200. The release is public, prerelease and
deliberately not marked latest; older releases were preserved.

Installer hashes from [SHA256SUMS](https://github.com/judus/phoenix/releases/download/v0.1.10/SHA256SUMS):

```text
a70ee2f121de997301b53c9fea6bb79abc26014ee04be9f45e8cbbf9fa7de0ea  PHOENIX-linux-x64.AppImage
9a5387851dab9a654453270b76680681a3992ea001554cd1b78c0b71a21d17a9  PHOENIX-windows-x64-setup.exe
```

Actual-model route selection, installed-device upgrade and real Elite route plotting from
text/voice remain pending; simulated input and CI are not gameplay acceptance.
The Windows installer remains unsigned. EDDN production gating is unchanged.

## Previous preview evidence: 0.1.9

The candidate includes the shared CSS/theme polish and GalNet workspace work from
[#210](https://github.com/judus/phoenix/issues/210), through source commit `5b1a61c`.
The local source gate passed 275 files / 1,744 tests, strict production/test typechecks
and builds. Isolated browser checks covered both themes and tablet orientations,
incremental news loading, reader/analysis navigation and preserved selection/scroll,
the independent queue page and expanded long diagnostics. Maintainer source-checkout
visual feedback shaped the final layouts.

Published preview: [v0.1.9](https://github.com/judus/phoenix/releases/tag/v0.1.9), exact source
`5e25e7f34de9399b96b2f51a543fb1c87e8f6a1a`. Development [PR #213](https://github.com/judus/phoenix/pull/213)
passed both native source gates in [run 38188317671](https://github.com/judus/phoenix/actions/runs/38188317671).
Promotion [PR #214](https://github.com/judus/phoenix/pull/214) passed native Linux/Windows installer checks
in [run 38188710961](https://github.com/judus/phoenix/actions/runs/38188710961).
Both exact-tag native builds and draft assembly passed in
[release run 38189033507](https://github.com/judus/phoenix/actions/runs/38189033507).

Downloaded installers/manifests matched all four original SHA-256 checksums, version,
exact source, preview channel and byte counts; both identify Node `v24.14.0`.
Both public installer links returned HTTP 200 after publication. The release is not draft,
is a prerelease and was deliberately not marked latest. Older releases were preserved.

Installer hashes from [SHA256SUMS](https://github.com/judus/phoenix/releases/download/v0.1.9/SHA256SUMS):

```text
cee9be22088d8e3444ce424c1ca6d5b4faeaeed702c21f4908f0a931a7224982  PHOENIX-linux-x64.AppImage
8bce42c2be96f600b5d2b383e9f222cc81322e521bed8fbfc9b883c3ddaa58e5  PHOENIX-windows-x64-setup.exe
```

Actual installed upgrade, retained-data, Windows/Elite and desktop-portal acceptance
remain pending; source/browser tests do not replace them. The Windows installer remains
unsigned, and EDDN production gating is unchanged.

## Previous preview evidence: 0.1.8

The candidate starts from dev `b8407780471cb0ec3c4f347ffc0472e2538aea1d`, including
[PR #202](https://github.com/judus/phoenix/pull/202) and
[PR #204](https://github.com/judus/phoenix/pull/204). Both native source gates passed;
the final local gate passed 274 files / 1,707 tests, strict production/test typechecks and builds.
Query-result Atlas reuse, toolbar consistency, navigation and deck management were checked in
isolated browsers in both themes/orientations. The maintainer reviewed the vertical deck swipe
prototype; measured animation timing/easing matched horizontal Deskplane navigation. Copilot's
fresh-tap-after-snap-back finding was fixed and covered by tests and a browser regression.

Published preview: [v0.1.8](https://github.com/judus/phoenix/releases/tag/v0.1.8), source
`5c95243cd6040b106e995484a5b136a54e503924`. Promotion [PR #206](https://github.com/judus/phoenix/pull/206)
passed native Linux/Windows installer checks in
[CI run 38098783645](https://github.com/judus/phoenix/actions/runs/38098783645).
Both tagged native installer jobs and draft assembly passed in
[release run 38099024938](https://github.com/judus/phoenix/actions/runs/38099024938).
Downloaded installers/manifests matched all four original checksums, version, exact source,
preview channel and byte counts. Both manifests identify bundled Node `v24.14.0`.
Both public installer links returned HTTP 200 after publication; the release is not draft,
is a prerelease and was deliberately not marked latest. Older releases were preserved.
Dependencies remain `deskplane@0.1.4`, embedded Control Deck runtime `0.1.13` and
`@jdu/llm-client@0.1.3`; the Windows installer remains unsigned.

Installer hashes from [SHA256SUMS](https://github.com/judus/phoenix/releases/download/v0.1.8/SHA256SUMS):

```text
d90f4d9f15d311132bcc94f998ca45d8d57244942f2eae0c25bd2300a7ab672c  PHOENIX-linux-x64.AppImage
9f9e1bedb470c6bce55581206e1b01380c7e0fdaa0614a5f12f1474ff4669797  PHOENIX-windows-x64-setup.exe
```

Real installed-device upgrade, retained-data, Windows/Elite and desktop-portal acceptance remain pending. Powerplay,
colonisation and Fleet Carrier pages are explicitly work-in-progress proposals needing gameplay
data; no CAPI integration or verified gameplay completion is claimed. EDDN gating is unchanged.

## Previous preview evidence: 0.1.7

- Published preview: [v0.1.7](https://github.com/judus/phoenix/releases/tag/v0.1.7), source
  `9f345526b296e9b27e387f02b25660c8460a7865`. Both native installer jobs passed in
  [release run 38016202187](https://github.com/judus/phoenix/actions/runs/38016202187).
  Bundled Node is `v24.14.0`; Windows installer remains unsigned.
- Promoted dev baseline: `fb64541c816879f654f4a9d88377cafa13cdc47f` via
  [PR #186](https://github.com/judus/phoenix/pull/186). Native installer promotion checks passed in
  [CI run 38015941837](https://github.com/judus/phoenix/actions/runs/38015941837) on
  Ubuntu 24.04 and Windows Server 2022. The full source gate passed 257 files / 1,622 tests,
  strict production/test typechecks and builds. Ordinary dev CI checks source/tests, **not installers**.
- v0.1.7 consumes `deskplane@0.1.4`, embedded Control Deck runtime `0.1.13` and
  `@jdu/llm-client@0.1.3`. Earlier preview acceptance does not prove these changes on actual devices.

Both installers and manifests were downloaded and independently verified before publication:
version, source SHA, preview channel, bundled Node, byte counts and all four original checksums.
Public download links returned HTTP 200 after publication. Older releases were preserved.

Published installer hashes from [SHA256SUMS](https://github.com/judus/phoenix/releases/download/v0.1.7/SHA256SUMS):

```text
5b26b82af97cf64c0dd320fe5a8d78c8668672cd4e9e5008d91d497628e9add9  PHOENIX-linux-x64.AppImage
990b614e5170c8945d6f6df9499cf36f3ca5bdde780f86a64b230d4c7aec0c16  PHOENIX-windows-x64-setup.exe
```

The [Linux](https://github.com/judus/phoenix/releases/download/v0.1.7/PHOENIX-linux-x64-build.json)
and [Windows](https://github.com/judus/phoenix/releases/download/v0.1.7/PHOENIX-windows-x64-build.json)
manifests record version, source, runtime and packaged file hashes. These prove artifact identity,
not successful input or observation inside Elite.

v0.1.7 includes custom control decks, schematic 3D Atlas and personal notes. Maintainer source
checks and isolated browser regressions cover both themes, linked mission/location navigation,
body actions and Notes workspace recall. Actual-model Copilot note usage and this release's
installed-device/retained-data upgrade acceptance remain pending. The body detail header needs
later visual refinement; no sidebar redesign is claimed.

One earlier Windows dev-push run timed out two existing GalNet HTTP tests at the default five
seconds ([run 38015636326](https://github.com/judus/phoenix/actions/runs/38015636326)).
Subsequent preparation, promotion and tagged release gates passed. This timing observation is
not evidence of a fixed or confirmed production defect.

## Acceptance matrix

**Automated** means fixtures/browser checks/native CI. **Reported** means maintainer feedback
without a complete device/version record. **Pending** is unverified, not a confirmed bug.
Historical unisolated tablet lag/crash and macro reports remain reproduction checks.
[#13](https://github.com/judus/phoenix/issues/13) records the completed workspace-gesture scope;
the matrix below retains its next-installed-build acceptance checks, not a second implementation task.

| Area | Existing evidence | Next check / owner |
| --- | --- | --- |
| Installer lifecycle | v0.1.9 native CI passed; isolated smoke covers startup, single instance, stop, settings migration and corrupt-settings recovery. | Maintainer: exact published build on Windows/Linux, actual install/update/tray/restart/uninstall. |
| Retained data | Smoke preserves pairing identity, edited Copilot profile and EDDN opt-out; domain tests cover other stored objects. | Maintainer: actual update/uninstall preserves settings, decks/macros, projects, queries, bookmarks and observed state. Back up; do not reset the profile to pass. |
| Linux desktops / input | PHOENIX AppImage launch/tray reported working on Mint; hardware/session record incomplete. Private-D-Bus and extract-and-run checks automated. | Maintainer: record distro/desktop/session/portal versions; test Mint plus KDE/Wayland and GNOME/Wayland, portal permission/revocation, input release, FUSE/extract-and-run and tray/quit. Earlier Arch/KDE and Fedora/GNOME results covered **Control Deck**, not PHOENIX. |
| Windows / Elite input | Historical real-game success; current Windows CI uses simulated input. Current complete gameplay record pending. | Windows maintainer: Elite focused, one safe known-good and one formerly failing binding; tap/hold/release, macro stop/cancel/failure, shutdown cleanup. Record game response, not HTTP success or Notepad typing. |
| Pairing / LAN | Automated QR claim, sessions and reconnect regressions. | Maintainer: tablet scans fresh QR without manual code, reconnect after restart, revoke, reject stale/invalid code; record browser/network/firewall without secrets. |
| Tablet gestures / recall | [PR #47](https://github.com/judus/phoenix/pull/47) records both-theme/orientation browser checks and maintainer acceptance; Deskplane 0.1.4 is bundled. | Next installer: taps versus swipes, protected hold/arming controls, edit drag/swap, CTR/INF/CPT recall and cold Quick Access. Atlas/schematic pan/pinch and forms must not navigate. Record device/browser/session length. |
| Copilot chat / workspace lifetime | [PR #159](https://github.com/judus/phoenix/pull/159) and [#161](https://github.com/judus/phoenix/pull/161): real tool navigation/history persistence with a synthetic provider, four browser theme/orientation layouts, bounded transcript rendering and anchored older messages. Maintainer reports the source-checkout tablet interaction is much better. | Published installer: tool opens Atlas during a reply, return to chat, confirm reply/history and next-turn context; long history, older-message scrolling and fast workspace switches. Source/browser acceptance is not packaged-device acceptance. |
| Numpy / macros | Faster Numpy accepted and shipped in v0.1.5; owner/consumer regressions passed. | Next installer + Elite: fast address bursts, cancel/focus return, deck order, command result and balanced cleanup on abort/failure. Reproduce historical anomalies before calling them bugs. |
| Odyssey equipment / access | Projection/planner/catalogue tests; complete real-play evidence pending. [#12](https://github.com/judus/phoenix/issues/12) owns the saved-project validation gate. | Maintainer: purchase/pre-upgraded/pre-modified gear, upgrade/modification/sale, EngineerProgress, Locker/Backpack changes. Work through suit, technology-sensitive weapon modification and pre-modified gear plans before persisting projects. |
| Saved queries | [PR #49](https://github.com/judus/phoenix/pull/49): 1,094 tests, shell checks, Linux payload and maintainer acceptance. | Next installed build: dynamic origin after travel versus fixed origin; edits/deletions survive updates/restarts; explicit import preserves same-name personal queries. |
| Dashboards | Central journal/Status projections and regression tests. | Maintainer: ship/SRV/on-foot transitions, hull after station repair, modules/inventory/cargo/legal state and commander log. Distinguish stale/unknown snapshots and game bugs from app inference. |
| Cartography / routes | [PR #46](https://github.com/judus/phoenix/pull/46) and #47 record shell/coordinate/navigation checks. | Maintainer: newly discovered system before provider ingestion, new scans, bookmarks/coordinates, route completion/earlier-leg preview, carrier toggle, sidebars/pan/pinch, both themes/orientations. |
| EDDN native contribution | Synthetic mapping/service/outbox tests; production uploads gated off. Historical authorized test-stream success is not downstream ingestion proof. | [#20](https://github.com/judus/phoenix/issues/20): public-field review, rotation/continuity, offline expiry/loss accounting and crash-time batching. Separately authorized real-game/test-stream checks plus native packages; retain another uploader. CAPI/OAuth stays deferred. |
| Antivirus / signing | Windows installer unsigned. | Maintainer: exact artifact hash, Defender/SmartScreen/product versions and outcomes. Signing/publication decisions remain separate; no bypass or certification claim. |

## Test record

Use one record per build/platform; keep private logs and screenshots out of public issues.

```text
Date / tester:
Source commit / release tag:
Installer filename / SHA-256 (or explicitly source checkout):
Node / embedded Control Deck / Deskplane versions:
OS / desktop / X11 or Wayland / portal:
Elite version / browser / tablet model:
Check / prerequisites / observed event sequence:
Result: passed | failed | pending | not applicable (reason)
Evidence: public CI/PR link or redacted private reproduction reference
Limits / next action / responsible person:
```

For input, record actual resolved chords and tap/hold/release **in-game** responses. For telemetry,
identify the authoritative event/snapshot and stale/unknown state. Do not publish commander names,
pairing secrets, tokens or unredacted journals.

## Release checkpoint

- [x] Verify v0.1.9 source/tag, both downloaded installer hashes and manifests.
- [x] Repeat automated native lifecycle/retained-data smoke tests for v0.1.9.
- [ ] Record actual installed upgrade/lifecycle/retained-data acceptance on each platform.
- [ ] Record applicable real-game/tablet/desktop rows and explicitly list pending platforms.
- [x] Keep EDDN production gating unchanged; #20 readiness work remains separate.
- [x] Review signing warnings and truthful preview notes; publish v0.1.9 as prerelease, not latest.

The [release guide](releases.md), [packaging guide](../scripts/package/README.md) and
[source setup](installation.md) own procedures; this document owns status/evidence.
[#23](https://github.com/judus/phoenix/issues/23) separately tracks installer-required promotion
check identity. Curating this matrix does not authorize protection changes or workflow dispatches.
Completing the document for #25 does **not** mean the manual checks have been executed.
