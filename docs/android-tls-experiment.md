# Android native TLS gateway experiment (#217)

This branch is an opt-in experiment, not a release or a replacement for ordinary HTTP access.
The separate APK is `io.github.judus.phoenix.tunnel` and has its own connection and WebView storage.

## Try it

1. Run `npm run build`. The TLS listener serves the **built** web app, not Vite/HMR.
2. Run `node scripts/experiments/android-tls.mjs prepare` once. OpenSSL creates a private,
   installation-specific certificate/key in ignored `data/runtime/android-tls` (90-day expiry).
   Current IPv4 addresses and the Android emulator host alias are included in its certificate.
3. Stop your existing dev server yourself, then run
   `node scripts/experiments/android-tls.mjs run`. HTTP 3400/3401 remains available;
   the additional TLS listener uses 3443. Rebuild web assets when testing further UI edits.
4. In another terminal run `node scripts/experiments/android-tls.mjs qr`, then open
   `http://127.0.0.1:3444` **on the computer**. Its QR is a pairing credential; do not share it.
5. In `apps/android`, run `./gradlew :app:assembleTunnel`. Install
   `app/build/outputs/apk/tunnel/app-tunnel.apk` alongside, not over, your existing APK.
6. Scan the experimental **LAN** QR with that APK. Ordinary pairing QR codes are not accepted.
   Manual connection requires the HTTPS origin, the displayed SHA-256 certificate fingerprint
   and the ordinary pairing code. The whole experimental link can also be pasted into the address.

Test Control Decks, Notes creation/editing/deletion, Atlas and query results, Galnet, and Copilot
text streaming. Check orientation changes, close/reopen, computer disconnect/reconnect, and device
revocation from the desktop. Agent diagnostics use synthetic data, recorded keyboard output and
synthetic Copilot responses; do not enable paid inference or game input for automated tests.

## Boundary

WebView HTTP `127.0.0.1:43184` -> native pinned TLS -> the existing PHOENIX route handlers.
NanoHTTPD 2.3.1 owns loopback HTTP parsing; OkHttp 4.12.0 owns upstream transport. Full request
bodies up to the existing 64 KiB JSON limit are forwarded; responses and event streams are streamed.
Only one request per loopback socket is accepted; workers and cancellation watchers are bounded.
EOF cancels the upstream request, including while waiting for headers or an idle event stream.
Chunked request uploads and WebSocket upgrades are **not** supported by this prototype. PHOENIX's
current same-origin fetch/EventSource routes do not need them. External links remain external.

The QR's exact SHA-256 leaf certificate identity is verified along with certificate validity and
normal hostname verification. There is no trust-all handler, global trust modification,
WebView certificate-error bypass, JavaScript/native bridge or silent HTTP fallback. Renewal or
an address change outside the certificate's SAN requires preparing a new identity and rescanning.

The remote `phoenix_session` cookie lives in private native preferences, bound to origin and pin;
it is never exposed to the WebView. The loopback listener binds only 127.0.0.1, checks Host/Origin
and requires a random HttpOnly/SameSite capability cookie. A port collision fails closed rather
than loading another local service. The stable local origin retains browser preferences on restart.
TLS connections always need ordinary device pairing, even from loopback; they cannot inherit
desktop-owner rights through a local proxy. Normal HTTP pairing semantics are unchanged.

This does not yet certify hostile-app resistance, physical-tablet/LAN behavior, load limits,
Google Play acceptance or production lifecycle robustness. Microphone capture/voice is not enabled:
the current Android shell does not request RECORD_AUDIO or grant WebView audio capture permissions.
The local origin's secure-context status alone is not proof that real voice works.

## Verified on this experimental branch (2026-10-12)

- Full PHOENIX `npm run check`: 275 test files / 1,746 tests, production/test typechecks and builds.
- Normal debug and separate tunnel Android builds, unit tests and lint pass (minimum SDK remains 30).
- Native socket regressions cover QR identity parsing, certificate pin/hostname/expiry rejection,
  origin/Host/capability guards, body limits, raw encoded paths/queries, cookie isolation, redirects,
  cancellation before headers and while streaming, and reconnect with the same desktop identity.
- Android 15 emulator / Chrome WebView 124 loads the real built frontend at a secure-context
  loopback origin. Notes Unicode CRUD, five synthetic query results, navigation data, live SSE,
  and a synthetic three-chunk Copilot response pass without external inference or game input.
  The ship deck renders its controls; a deliberately unbound synthetic action POST reaches the
  server and returns its normal rejection result (not a claim of working real-game input).
- Real Atlas rendering checked in both themes at landscape and portrait tablet sizes.
- Whole-process restart and Activity recreation retain the native session and localStorage.
  Desktop revocation returns the WebView to the existing native re-pair card.

These checks do not replace physical-device, QR-camera, real-game or voice acceptance.
