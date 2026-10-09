# PHOENIX acceptance checklist

Reviewed **2026-10-09**. Tracking task: [#25](https://github.com/judus/phoenix/issues/25).
This records evidence and outstanding tests, not a claim that every platform/gameplay check passed.
Refresh the build identity and results before each release.

## Build identities

- Published preview: [v0.1.6](https://github.com/judus/phoenix/releases/tag/v0.1.6), source
  `9d4f10f813ee70709e7490aab7afe4c2224c854a`. Both native installer jobs passed in
  [release run 37865965880](https://github.com/judus/phoenix/actions/runs/37865965880).
  Bundled Node is `v24.14.0`; Windows installer remains unsigned.
- Promoted dev baseline: `294c7c201baaa40e0cc16539566b21ba6417a2ca` via
  [PR #164](https://github.com/judus/phoenix/pull/164). Native installer promotion checks passed in
  [CI run 37865573027](https://github.com/judus/phoenix/actions/runs/37865573027) on
  Ubuntu 24.04 and Windows Server 2022. The full source gate passed 251 files / 1,569 tests,
  strict production/test typechecks and builds. Ordinary dev CI checks source/tests, **not installers**.
- v0.1.6 consumes `deskplane@0.1.4`, embedded Control Deck runtime `0.1.13` and
  `@jdu/llm-client@0.1.3`. Earlier preview acceptance does not prove these changes on actual devices.

Both installers and manifests were downloaded and independently verified before publication:
version, source SHA, preview channel, bundled Node, byte counts and all four original checksums.
Public download links returned HTTP 200 after publication. Older releases were preserved.

Published installer hashes from [SHA256SUMS](https://github.com/judus/phoenix/releases/download/v0.1.6/SHA256SUMS):

```text
93ca4de5ff186cbedde0e19deac59cd1cb79a00d3e85fd01c110dd6d2faeb27a  PHOENIX-linux-x64.AppImage
791907aec31635084736e8ba8f2b8d10e512a8ddf4f3cb9593c5b18b27cc4fac  PHOENIX-windows-x64-setup.exe
```

The [Linux](https://github.com/judus/phoenix/releases/download/v0.1.6/PHOENIX-linux-x64-build.json)
and [Windows](https://github.com/judus/phoenix/releases/download/v0.1.6/PHOENIX-windows-x64-build.json)
manifests record version, source, runtime and packaged file hashes. These prove artifact identity,
not successful input or observation inside Elite.

## Acceptance matrix

**Automated** means fixtures/browser checks/native CI. **Reported** means maintainer feedback
without a complete device/version record. **Pending** is unverified, not a confirmed bug.
Historical unisolated tablet lag/crash and macro reports remain reproduction checks.
[#13](https://github.com/judus/phoenix/issues/13) records the completed workspace-gesture scope;
the matrix below retains its next-installed-build acceptance checks, not a second implementation task.

| Area | Existing evidence | Next check / owner |
| --- | --- | --- |
| Installer lifecycle | v0.1.6 native CI passed; isolated smoke covers startup, single instance, stop, settings migration and corrupt-settings recovery. | Maintainer: exact published build on Windows/Linux, actual install/update/tray/restart/uninstall. |
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

- [x] Verify v0.1.6 source/tag, both downloaded installer hashes and manifests.
- [x] Repeat automated native lifecycle/retained-data smoke tests for v0.1.6.
- [ ] Record actual installed upgrade/lifecycle/retained-data acceptance on each platform.
- [ ] Record applicable real-game/tablet/desktop rows and explicitly list pending platforms.
- [x] Keep EDDN production gating unchanged; #20 readiness work remains separate.
- [x] Review signing warnings and truthful preview notes; publish v0.1.6 as prerelease, not latest.

The [release guide](releases.md), [packaging guide](../scripts/package/README.md) and
[source setup](installation.md) own procedures; this document owns status/evidence.
[#23](https://github.com/judus/phoenix/issues/23) separately tracks installer-required promotion
check identity. Curating this matrix does not authorize protection changes or workflow dispatches.
Completing the document for #25 does **not** mean the manual checks have been executed.
