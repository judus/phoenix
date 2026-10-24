# Android native TLS gateway experiment (#217)

This branch is an opt-in experiment, not a release or a replacement for ordinary HTTP access.
The separate APK is `io.github.judus.phoenix.tunnel` and has its own connection and WebView storage.

## Try it

1. Run `npm run build`. The TLS listener serves the **built** web app, not Vite/HMR.
2. The first `run` command prepares a private identity automatically when both files are absent.
   Optional `node scripts/experiments/android-tls.mjs prepare` prepares it beforehand. OpenSSL creates a private,
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

`run` and `qr` reject an incomplete, mismatched, not-yet-valid or expired identity before proceeding.
They never silently replace existing certificate files. Check the PC clock first for validity errors.
For deliberate renewal or a changed LAN address, stop the experimental listener, run
`node scripts/experiments/android-tls.mjs renew`, restart it and scan its new QR on each device.
Renewal changes the exact leaf pin, so old saved pins fail closed until re-pairing. The key stays in
the PC's ignored runtime directory (mode0600 on Unix); it is never put in the QR or APK.
This OpenSSL-based tool is development/opt-in setup, not an automatic certificate-provisioning service
for a published desktop installer. It needs no public DNS, certificate authority or Internet connection.

## Failure and recovery contract

The native client permits at most one additional GET/HEAD attempt when a connection fails before
response headers. Both attempts belong to the same cancellable call. Certificate/pin/hostname,
protocol and cancellation failures are not retried. HTTP error responses are returned unchanged;
desktop JSON provider failures must not be diagnosed as native TLS failure.

The gateway suppresses OkHttp 4.12's internal 503/Retry-After follow-up independently of
connection recovery. The caller receives the original HTTP status, Retry-After fields and body;
GET and POST 503 responses each make exactly one upstream request. This is enforced by a network
interceptor which temporarily changes Retry-After for the library's follow-up decision and an
application interceptor which restores only those fields, preserving normal body decoding.
POST/PUT/PATCH/DELETE requests and response-body/SSE reads are never automatically replayed.
Losing a response after an action may mean the action ran; reconnect/reload must not resubmit it.
An interrupted event stream can reconnect according to its existing read subscription contract,
not by the native gateway restarting a partially delivered body. A total two-minute budget covers connect, TLS handshake, request transmission, recovery and response
headers. It leaves headroom for existing non-streaming Spansh (30-second), macro/tool (60-second)
and provider (90-second) server work before JSON headers; TCP connect still has its five-second limit. Expiry cancels the same Call and cannot trigger read recovery. Once headers arrive the
budget is removed; established SSE/body reads have no idle deadline and remain locally cancellable.
HEAD preserves the upstream representation Content-Length (including its absence) and sends no body.
Activity shutdown closes the loopback port, cancels active calls and cleans up TLS connections away
from Android's UI thread. One synchronized owner covers bind, publication and destruction, so a
pairing worker finishing after Activity destruction cannot create a late listener.

A rejected lazy page import now remains inside the application shell. Navigation remains available;
the page offers an explicit **Reload PHOENIX** action. This reload starts a new document/module graph,
because remounting the same rejected React.lazy object cannot retry its cached import failure.
Changing routes can leave the failed page; healthy pages retain their existing state.

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

## Historical prototype evidence (2026-10-12)

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

Current development acceptance is recorded separately with the implementing branch/commit and exact
quality-gate results. The historical emulator checks above do not certify a later build. Transport
readiness includes same-origin fetch and SSE used by text/realtime control requests, but Android
microphone permission, audio capture and actual provider voice acceptance remain unverified.
