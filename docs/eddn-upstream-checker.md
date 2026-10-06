# Reviewing EDDN upstream changes

Run this maintenance command from the source checkout:

```sh
npm run eddn:check-upstream
# Machine-readable output without npm's own banner:
node scripts/eddn/check-upstream.mjs --json
```

It reads `resources/eddn/upstream.json`, checks local schema SHA-256 hashes and compares those
bytes with the pinned official Git blobs. It resolves EDDN's `live` and EDMC's `main` branches
to immutable revisions before comparing file trees. New/changed/removed top-level schema files,
protocol documentation and the pinned EDMC uploader/monitor/CAPI review paths are listed with
revision-comparison links. A repository revision change still requires review even if none of
these selected files changed; this is not a semantic analysis of arbitrary Python dependencies.

Exit codes: **0** unchanged, **1** review required, **2** incomplete (network/API error,
truncated/invalid upstream metadata or local schema-integrity problem). Partial results are
retained, but a failed source never produces an all-clear. Missing files are not silently ignored.
Existing unbundled schema families are shown as coverage information, not fresh drift; deprecated
blackmarket and deferred CAPI coverage do not make every unchanged check fail.

Requests are GET-only to GitHub, with 15-second timeouts and no automatic retries. Public reads
usually need no token. For rate-limited maintenance use a read-only `GITHUB_TOKEN` in your shell;
it is sent only to `api.github.com`, never printed, stored or passed to an upload endpoint. Do not
put credentials in repository files. Review a failure and rerun later rather than looping requests.

The checker is opt-in, not part of application startup, installers or the ordinary offline test
gate. It writes no files, changes no pins/mappings and submits no game data. Tests inject metadata
and fetch failures without external requests. It compares EDMC metadata only; it does not copy,
translate, execute or redistribute its GPL implementation.

## When changes are reported

1. Open the reported upstream comparison and read the affected official schema README/developer
   rules. Review any EDMC dispatch, privacy, context or delivery-policy changes as reference only.
2. Decide which journal/file changes apply to PHOENIX; keep CAPI deferred unless separately approved.
3. On a reviewed branch, deliberately update relevant pins, unmodified schemas, provenance and
   explicit privacy allowlists. Add service-path regressions and rerun the checker/full tests.
4. Update [the parity register](eddn-parity.md); do not claim readiness from matching hashes or
   revision numbers. Real-game/native-build acceptance and live activation remain separate gates.

Sources: [EDDN live developer guide](https://github.com/EDCD/EDDN/blob/live/docs/Developers.md),
[official schemas](https://github.com/EDCD/EDDN/tree/live/schemas),
[EDMC uploader reference](https://github.com/EDCD/EDMarketConnector/blob/main/plugins/eddn.py),
[GitHub tree API](https://docs.github.com/en/rest/git/trees#get-a-tree).
