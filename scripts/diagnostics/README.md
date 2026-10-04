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
