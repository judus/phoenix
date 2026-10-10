# Isolated diagnostics

## Native SQLite test timings

To investigate disk-backed integration-test timeouts, enable the opt-in profiler while running
the affected tests with their normal 5-second limit and SQLite durability:

```sh
PHOENIX_TEST_SQLITE_PROFILE=1 npx vitest run tests/cartography-migrations.test.ts tests/eddn-offline-policy.test.ts tests/galnet-analysis-http.test.ts tests/galnet-archive-http.test.ts tests/eddn-settings-api.test.ts --reporter=verbose
```

In PowerShell, set `$env:PHOENIX_TEST_SQLITE_PROFILE = '1'` before `npx.cmd vitest run ...` and
remove it afterwards with `Remove-Item Env:PHOENIX_TEST_SQLITE_PROFILE`. The profiler reports
per-test wall time, cumulative synchronous SQLite time, call count and the five slowest operation
names. It does not log SQL, bound values, stored documents or paths. Hooks include test cleanup;
constructor/file-permission work and HTTP waits are outside SQLite time. No machine-dependent
timing assertions are added. Profiling is off by default; compare repeated native runs, not just
one passing result. Run the full suite too when investigating contention between test files.

## Colonisation proposal

Use `--colonisation` with the isolated preview and open `#/activities/colonisation`.
Temporary synthetic claims, construction supplies and deliveries exercise the separate ledgers,
completed-site retention and station/system links. Check selection/tabs in both themes and orientations.
No CAPI, player journals or real income/ownership validation is involved.

## Powerplay proposal

After building, run `node --import tsx scripts/diagnostics/isolated-browser-preview.mjs --powerplay`
and open `#/activities/powerplay`. Synthetic pledge, fractional merits, collections/deliveries
and a deliberately fictional reward target live in temporary SQLite storage, removed on shutdown.
Check Overview/Activity/Target, save/clear, and both themes/orientations. No player journals,
CAPI, provider requests or EDDN submissions are involved. This does not validate game reward gates.

## Mission briefs

After building, run `node --import tsx scripts/diagnostics/isolated-browser-preview.mjs --mission-brief`
and open `#/activities/missions` on the printed URL. This creates a synthetic on-foot contract
and tagged backpack snapshot in temporary storage; no player journals or provider requests.

## Journal ingestion responsiveness

Build the workspace packages, then run this from the repository root:

```sh
npm run build
node --import tsx scripts/diagnostics/journal-profile.mjs --small=200 --large=20000 --repeats=3
```

The diagnostic creates and removes its own temporary journals and runs a fresh PHOENIX worker
with in-memory SQLite for each sample. EDDN is explicitly disabled, external fetch is rejected,
Copilot is disabled, and keyboard output remains simulated. No player files are accepted.
Generated records mix Progress/runtime changes, ReceiveText/persisted communications, FuelScoop
and an FSDJump every 250 records. Each sample measures latest-file startup, idle, appended tail,
truncation/offset reset, historical backfill and checkpoint-only replay. Complete-record counts
and final delivered SSE revisions must agree; the subsequent checkpoint replay must process zero records.

HTTP and SSE probes run in the **parent process**, independently of the server's event loop.
JSON output includes Node/platform/CPU, byte/line counts, ingestion wall time, before/after memory,
sampled RSS peak, cumulative process RSS high-water mark, event-loop histogram and timer lag,
HTTP p95/max latency, and maximum SSE delivery gap. Event-loop sampling gets a 50 ms drain after
ingestion; the parent separately waits for the actual target SSE revision with a 15-second safety
timeout, not a timing pass threshold. Wall time excludes these waits. Bootstrap begins at `start()`
after application construction/module loading; no HTTP/SSE server is available during bootstrap.
Explicit refreshes bypass the normal 500 ms live polling wait, so tail time is processing time,
not end-to-end gameplay latency. The worker uses private source handles only for this controlled
diagnostic; no production instrumentation or public lifecycle API is added.

Interpret results in this order: correct record/offset/revision handling, repeated latency versus
idle, then total processing time and memory. A large change repeated across samples is evidence;
small differences, sampled RSS and retained heap alone do not establish a leak. There are no
machine-dependent millisecond pass thresholds in CI. In-memory SQLite and this synthetic event
mix do not establish real journal/disk, EDDN-enabled, tablet, or Windows performance.

On 2026-10-06, Node 24.14.0/Linux x64/i7-14700K, three runs of 20,000 records (~1.82 MB) showed:

| Measurement | Before | After yielding every 256 complete lines |
| --- | --- | --- |
| Live tail total processing | 624–645 ms | 658–681 ms |
| Live tail worst HTTP response | 621–643 ms | 14–39 ms |
| Live tail maximum SSE delivery gap | 631–654 ms | 19–46 ms |
| Bootstrap maximum timer lag | 640–657 ms | 26–29 ms |
| Offset-reset maximum timer lag (2,000 records) | 54–61 ms | 10–20 ms |

Idle worst HTTP responses were 2–3 ms before and 2–4 ms after. Historical backfill already
yielded between 64 KiB reads: its maximum timer lag was 18–23 ms before and 11–25 ms after;
no history change was warranted. Latest-file bootstrap wall time stayed about 650 ms.
This improves fairness, **not throughput**. RSS deltas were noisy; no memory optimization or
bounded-read/streams rewrite was justified by these measurements. Repeat after meaningful changes.

## Browser stability check

Use `--galnet-continuity` and open `#/comms/galnet` for three fictional articles about the same
ship. Explicit catch-up runs a synthetic analyser (no model/provider requests); verify queue logs,
the source-backed story update, earlier search resolution, dated related-coverage timeline and
separate settings switch/limit in both themes and orientations. The later combat appeal stays a
canonical Community Goal, not a duplicate investigation lead. All external requests remain
rejected by the preview.

For Community Goals layout/selection checks, add `--community-goals` to the isolated preview
command below. It supplies twenty fictional goals with long briefings for independent list/detail
scrolling, without contacting Frontier or an AI provider.

Use only the supplied in-memory preview, never a player's server. It uses mock cartography,
simulated keyboard output, and no Elite journal ingestion or Copilot provider. Build the web
application, then start the fixture:

```sh
npm run build
node --import tsx scripts/diagnostics/isolated-browser-preview.mjs
```

Start a separate diagnostic Chrome with a fresh temporary profile and debugging port 9337.
Pass that profile's explicit path to `--user-data-dir`; do not attach to the user's browser.
Use the preview URL printed above:

```sh
node scripts/diagnostics/browser-session-soak.mjs --isolated-preview-url=http://127.0.0.1:PORT
```

The bounded run visits 500 distinct mocked systems, switches workspaces, and injects 2,000
schema-valid synthetic runtime events into the browser's event stream. It checks actual
cartography-request coverage, one active stream, and browser exceptions. Forced-GC samples
report heap, DOM and listener counts; heap deltas are measurements, not arbitrary pass thresholds.
The fixture disables Copilot, so an initial profiles request may report HTTP 503; other network
errors must be investigated. Stop both fixture and diagnostic Chrome after the run.

This accelerated desktop-browser test does not prove physical-tablet stability. Re-test on the
affected tablet during a sustained gameplay session before closing the reported lag/crash issue.

## Atlas POIs

Use `--atlas-pois` and open `#/galaxy/atlas` to test 1,500 synthetic POIs without external requests.
Check search/category filtering, off-screen location selection, dense clusters, source details and
map/sidebar interactions in both themes and orientations. The default preview disables external
Atlas feeds; the small bundled historical site remains available.

```sh
node --import tsx scripts/diagnostics/isolated-browser-preview.mjs --atlas-pois
```

## EDDN submission log

For EDDN log layout and selection checks, use `--eddn-submissions` and open `#/developer/eddn`.
This variant seeds 30 synthetic accepted/retry/rejected/interrupted attempts in a temporary
SQLite database (removed on normal shutdown). It never sends them. All preview variants force
EDDN delivery off regardless of the invoking environment's test-mode setting.

```sh
node --import tsx scripts/diagnostics/isolated-browser-preview.mjs --eddn-submissions
```

## Live-update performance profile

The separate profile measures unnecessary live-update work, not a crash diagnosis. Start the
same fixture with `--dense-cartography`: its schema-validated mock system contains 121 bodies
and 40 attached stations (20 fleet carriers). The default fixture remains empty for the original
soak. Both fixture modes reject external `fetch` requests instead of contacting providers.

```sh
node --import tsx scripts/diagnostics/isolated-browser-preview.mjs --dense-cartography
```

Use a **fresh diagnostic Chrome**, a temporary profile, and an unused local debugging port
(9344 by default). Do not attach to a normal browser or another diagnostic's session.

```sh
node scripts/diagnostics/browser-update-profile.mjs --isolated-preview-url=http://127.0.0.1:PORT --debugging-port=9344
```

The bounded run warms five routes, then compares a five-second quiet interval with 100
schema-valid unchanged-runtime revision events, spaced 50 ms apart, on each route. It reports
API request counts, production React **root commits** (not per-component renders), forced-GC
heap, DOM and listener counts, and cumulative Chrome script/task/layout/style time deltas.
Each sample requires exactly one active event stream. Browser exceptions, unexpected external
HTTP requests, failed non-cancelled requests and unexpected HTTP errors fail the run; the
disabled-Copilot profiles HTTP 503 is expected.
The profile forces a new document (not a hash-only navigation), verifies its entry asset against
the current local `apps/web/dist/index.html`, and requires the expected page heading, successful
initial API response, and all 121 schematic bodies before measuring. It removes its future-document
instrumentation on exit. A normal Chrome or a stale page must not be substituted for this fixture.

On the pre-optimization `ea91f70` production shell (2026-10-04, desktop headless Chrome,
800×1280 viewport), each 100-event interval made 100 inventory/engineering endpoint requests:
materials, blueprints, engineers, and personal materials. Engineering produced 300–301 root
commits versus 0–2 during quiet intervals. Personal materials produced 100 commits versus 2.
The dense schematic made no cartography request, produced 102 commits, and used 0.206 seconds
of script time versus about 0.000003 seconds in its quiet interval. DOM/listener counts did not
grow within those event intervals; after-GC heap deltas alone are not evidence of a leak.

After the approved refresh-key changes, the rebuilt entry `/assets/index-C2BfbzJX.js` was verified
in Chrome 154.0.8037.97, with the same fixture and viewport:

| Page | Endpoint requests before → after / 100 events | Root commits before → after |
| --- | --- | --- |
| Encoded materials | 100 → 0 | 301 → 100 |
| Blueprints | 100 → 0 | 300 → 100 |
| Engineers | 100 → 0 | 300 → 100 |
| Personal materials | 100 → 1 | 100 → 1 |
| Dense schematic | 0 → 0 | 102 → 101 |

The one personal-material request reconciles the first stream event with bootstrap state;
subsequent identical events are suppressed. Unrelated Copilot polling is counted separately.
Script time for engineering intervals fell from about 0.105–0.134 seconds to 0.038–0.044 seconds;
personal-material time fell from 0.040 to 0.008 seconds. These are desktop fixture measurements,
not a tablet benchmark. No geometry optimization was made: schematic script time stayed about
0.206 seconds per interval. No unexpected HTTP/network errors or browser exceptions occurred,
and the current document retained one stream. One attempted rerun was explicitly discarded:
hash-only navigation retained the old bundle and reset synthetic revisions below the browser's
monotonic revision guard. The forced-document and entry-asset gates prevent that false comparison.
Do not compare absolute heap/DOM totals across documents: Chrome may retain and later collect a
previous document during navigation; within-document samples distinguish that from request churn.

Repeat against a freshly rebuilt shell after any optimization and compare **requests first**;
small timing/heap differences are noisy and must not be used as absolute performance gates.
Relevant inventory, applied blueprint, engineer progress/location, project and cartography
changes must still refresh: focused automated tests enforce those dependency boundaries.
This fixture is intentionally not representative of real provider latency, large personal
inventories, GPU/tablet rendering, or a physical tablet's memory limits. The user reported no
tablet crashes in the days preceding this profile; no historical crash cause is established.
