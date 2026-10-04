# Isolated browser stability check

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
