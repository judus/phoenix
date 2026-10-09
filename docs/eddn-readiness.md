# EDDN native readiness checklist

This is the remaining acceptance plan for [#20](https://github.com/judus/phoenix/issues/20),
not permission to submit data, restart a player's app, contact maintainers or publish a release.
Normal builds cannot publish live data. Keep another uploader enabled. CAPI/OAuth is deferred;
native journal/file readiness will not establish full EDMC source or delivery equivalence.

## Automated evidence

- All 21 supported journal/file families have synthetic mapping/service coverage using pinned
  official schemas. Current public-field review is recorded in [the parity register](eddn-parity.md).
- File-backed recovery, real journal-source bootstrap/append, resolved/unresolved signal recovery,
  retry reservations, schema/opt-in revalidation, independent age bounds and capacity limits have
  isolated regression coverage. [Offline policy](eddn-contribution.md#offline-policy-reviewed-2026-10-07-114)
  intentionally retains 24-hour limits and no upload of gameplay from while PHOENIX was closed.
- Loss counters, opt-out, crew/session resets and rotation have automated coverage. #108 and
  #111 document low-severity exceptional storage/late-tail cases; they are not claimed fixed.
- Linux/Windows CI checks test/type/build behavior. Passing CI does **not** prove real Elite
  ingestion, installed Windows runtime behavior or ingestion by downstream community services.

## Authorized real-game checks — pending

Choose convenient gameplay, not purchases or forced historical resends. Obtain approval for
the specific test session and EDDN **test stream** before enabling it. Prior basic acceptance of
FSDJump, Scan, Docked, commodity and outfitting is recorded in [the contribution guide](eddn-contribution.md#verification-2026-10-04);
it predates the expanded mappings and is not a current-build sign-off.

- [ ] On a known build, confirm Location and fresh body scans, including available first-footfall,
  Powerplay or colonisation station fields. Compare the selected DEV payload with the actual
  system/station, original timestamp and source context; do not publish raw journals or identities.
- [ ] During ordinary exploration, verify FSSDiscoveryScan, FSSAllBodiesFound, FSSBodySignals,
  ScanBaryCentre, SAASignalsFound and batched FSSSignalDiscovered when naturally emitted.
  Verify mission targets/localised strings/timers do not leak. Missing events are not passes.
- [ ] Verify NavBeaconScan, ApproachSettlement and CodexEntry when available. Public site
  coordinates may be sent by their schemas; personal surface coordinates must not leak into
  generic Location/Docked uploads. Check direct or cross-checked Codex body identity.
- [ ] At a suitable station, verify docking granted/denied when naturally emitted, current
  market/outfitting and Shipyard snapshots. Check matching timestamp/MarketID/station/system;
  a Pioneer Supplies weapon merchant does not count as ship outfitting or shipyard coverage.
- [ ] Verify CarrierJump and FCMaterials at a suitable carrier, plus a fresh NavRoute snapshot.
  Record untested families as pending; no need to buy a carrier or manufacture a denial.
- [ ] With explicit session approval, check opt-out/re-enable, ordinary stop/restart and a
  short network interruption: durable pending work resumes after its retry deadline; replayed
  downtime records do not upload. Confirm DEV outcomes and Settings totals, not just HTTP 200.
  Use synthetic tests for destructive storage faults, exact 24-hour waits and capacity exhaustion.
- [ ] Check ordinary session/multipart rotation and crew transitions when feasible. Unknown
  or missing context must skip, never borrow another system/captain's data.

Record build/commit, platform, event/schema, source-match result and test-stream outcome without
private payloads. HTTP acceptance establishes only gateway acceptance, not listener ingestion.

## Installed-runtime acceptance — pending

- [ ] Build and verify current native payload/installers through the established release workflow
  or an authorized local build. Include all pinned schema assets and the validator dependency.
  Record exact commit/artifact/checksum; old installer results are not current-build evidence.
- [ ] On x64 Windows, launch the installed app with real Elite journals and verify discovery,
  ingestion, Settings/DEV status, ordinary shutdown/reopen and opt-out persistence. CI on Windows
  is useful build evidence, not this player-runtime check.
- [ ] On supported Linux, verify the packaged app's startup and normal gated status, including
  pending-clear feedback. Real journal tests need an explicitly configured authorized source;
  do not assume Wine/Proton discovery works merely because the AppImage starts.

## Before any live activation — separately authorized

- [ ] Re-run the read-only upstream checker and review any drift in schemas/rules. Never
  automatically update pins or reuse an obsolete schema because tests still pass.
- [ ] Obtain maintainer acceptance of the native-only coverage, retained downtime/retention
  policies, privacy disclosure and outstanding limitations. No blanket EDMC replacement claim.
- [ ] With approval, coordinate sender identity/version, event families, evidence and contact
  details with EDDN maintainers. Do not send credentials or player journals.
- [ ] Deliberately review a versioned release change for live publishing and development safeguards.
  Do not just remove `/test`, reuse a test-mode flag as live authorization or publish during this review.

Close #20 only when its agreed native acceptance is verified and recorded, or explicitly rescope
it with the maintainer. Synthetic checks and this document alone do not close it.
