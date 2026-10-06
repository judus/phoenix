# Pinned EDDN schemas

Unmodified upstream JSON from EDCD/EDDN `live`, revision
`4ad669bb7bbe1eae080e4c354e786dca4db91f35` (retrieved 2026-10-04).

Source: https://github.com/EDCD/EDDN/tree/4ad669bb7bbe1eae080e4c354e786dca4db91f35/schemas

BSD-3-Clause; full notice in `licenses/EDDN-BSD-3-Clause.txt` in PHOENIX's root.
The runtime compiles local copies as test schemas (only id and `$schemaRef` change).
No runtime schema download. Review upstream documentation and tests when updating the pin.

Mapping code is PHOENIX's explicit allowlist implementation of the documented protocol;
no EDMC or EliteDangerousCore source has been copied.

Sixteen schemas are now pinned. `upstream.json` records the EDMC behavioural reference
revision and SHA-256 hashes of each unmodified schema for future drift checks. It is
maintenance metadata only; runtime never fetches upstream or loads this as executable policy.
See `docs/eddn-parity.md` for coverage and the unresolved CAPI/acceptance gates.
Run `npm run eddn:check-upstream` for an opt-in read-only review; usage and exit codes are in
`docs/eddn-upstream-checker.md`. The checker does not belong to the runtime submission path.

## Checkout integrity

Versioned schema JSON files are excluded from Git line-ending conversion in `.gitattributes`.
Keep their upstream bytes unchanged: the checker validates SHA-256 and Git blob hashes on all platforms.
