# Payload and installer tooling

PHOENIX packages are host-native. Build Linux installers on Linux x64 and Windows installers on
Windows x64; the Windows package embeds the host Node runtime and compiles a native tray launcher,
so it cannot be produced correctly from Linux.

## Storefront-neutral payload

`npm run payload:build` creates a platform-specific payload under `dist/payload/`. It contains
compiled application code, curated resources, production dependencies, and the Node runtime
executing the build.

Bundled Copilot profiles live in `resources/copilots/`. On startup they seed writable profiles
under the existing user-data path `copilot/agents/`; character edits and user-created profiles
survive upgrades. `PHOENIX_AGENTS_PATH` retains its existing role as a bundled-profile override.
The repository's `AGENTS.md` and `.agents/skills/` are coding instructions, not runtime resources,
and are not included in the payload.

Bundled saved-query definitions live in `resources/queries/predefined.json`. A new user database
receives editable copies once. Upgrades never overwrite edits or restore deleted queries; existing
profiles can explicitly use **Add predefined queries** in Saved Queries. Definitions have stable
IDs, so repeated imports preserve existing copies, irrespective of their names.

`npm run payload:verify` checks every staged file against `manifest.json`. `npm run payload:smoke`
starts a temporary copy in installed mode and verifies that mutable state is written to isolated
platform user directories. Linux additionally makes the temporary installation read-only.
The smoke test also checks duplicate launch, clean stop, retained pairing/profile data across
restart, a version-two settings migration that preserves customization, and failed startup with
corrupt settings followed by recovery. It removes developer PHOENIX path/provider overrides from
the child environment and uses an empty Elite directory and simulated input backend. It never
repairs or resets the player's configuration.

Every smoke run also executes the **bundled** catalogue worker against a fresh isolated snapshot,
so missing/incompatible bundled dependencies fail the packaging gate without a network dependency.
To exercise a real legacy-catalogue upgrade during startup, run
`PHOENIX_SMOKE_LIVE_CATALOGUE=1 npm run payload:smoke` on Linux (PowerShell: set
`$env:PHOENIX_SMOKE_LIVE_CATALOGUE = '1'` before the command). This opt-in check downloads community
catalogues into temporary user data, beginning with a schema-1 manifest; it never uses player data.
Set `PHOENIX_SMOKE_LAUNCHER` to the absolute AppImage path to test its actual entrypoint too.

## Linux x64 AppImage

Build on Linux x64 with Node 24.14, GNU tar, `dpkg-deb`, `desktop-file-validate` (desktop-file-utils),
`dbus-run-session`/`dbus-daemon` for isolated tray verification, and the desktop runtime libraries
below. `dpkg-deb` extracts pinned build dependencies; it does
not restrict which distributions can run the resulting AppImage. No root installation is performed.

```sh
npm ci
npm run installer:linux
npm run installer:linux:verify
```

Output: `dist/installer/PHOENIX-<version>-x86_64.AppImage`, plus a packaging manifest sidecar.
The image bundles PHOENIX's existing payload and Node runtime, pinned xdotool/libxdo for X11,
and the versioned Control Deck Wayland keymap reader. Builds verify download/artifact hashes;
`appimage-resources.json` pins the tool, embedded runtime and input helpers. Build manifests
record dependencies and all AppDir hashes. Third-party notices and the helper licence travel
inside the image. No sibling Control Deck checkout, system Node or compiler is needed to run it.

Runtime baseline: Linux x86-64 with glibc >= 2.34, libstdc++ supporting the bundled Node runtime,
`xdg-open`/a browser, and desktop libraries (`libX11.so.6`, `libXtst.so.6`, `libXinerama.so.1` on
X11; `libwayland-client.so.0` on Wayland). Wayland controls require a working XDG RemoteDesktop
portal with keyboard support and user permission. No host `xkbcli` is required by the AppImage.
This targets modern Ubuntu/Mint, Fedora and Arch desktops, not musl/Alpine or every Linux release.

```sh
chmod +x PHOENIX-0.1.4-x86_64.AppImage
./PHOENIX-0.1.4-x86_64.AppImage
# Quit the background server:
./PHOENIX-0.1.4-x86_64.AppImage --stop
# If mounting through FUSE is unavailable:
./PHOENIX-0.1.4-x86_64.AppImage --appimage-extract-and-run
```

The launcher opens the browser and offers a PHOENIX tray icon with Open, Pair device, Open logs,
and Quit actions. It uses the session D-Bus StatusNotifier protocol (including dbusmenu), not a
desktop framework. A compatible tray host is required; desktops without one still run PHOENIX
and can stop it with `--stop`. `--non-interactive` or `PHOENIX_DESKTOP_INTEGRATION=false` disables
the tray. No desktop shortcuts or auto-update are installed. User data
stays in the existing XDG config/data/state roots; replace the stopped image to upgrade, or delete
the stopped image to remove the application without deleting user data. Do not downgrade stored
data without a backup. See [AppImage's FUSE guidance](https://docs.appimage.org/user-guide/troubleshooting/fuse.html).

Linux startup failures are logged to `$XDG_STATE_HOME/phoenix/logs/phoenix.log` (default
`~/.local/state/phoenix/logs/phoenix.log`) and shown through `notify-send` when available. If desktop
notifications fail or are unavailable, the launcher asks `xdg-open` to display that log in the
default viewer. Neither desktop tool is invoked in headless sessions or with `--non-interactive`.
The log/stderr remains the fallback when no working desktop handler is installed.

The verifier exercises tray registration, menu properties, host restart, and action dispatch on a
private D-Bus session. It also launches the actual AppImage with isolated user roots and checks
Open/Pair/Logs destinations, duplicate launch and clean shutdown from the Quit menu item. No real
browser or game input is triggered. This does not replace visual testing on the target desktop.

The verifier checks the pinned ELF runtime, every AppDir file, helper executability, the desktop
entry and payload hashes. It then exercises both the extracted AppRun and the actual image using
extract-and-run, with isolated settings/data, no portal requests and no real input. FUSE mounting,
browser/LAN pairing, desktop portals and live Elite/Proton controls still require manual tests.
Previous Arch/KDE and Fedora/GNOME acceptance covered **Control Deck**, not this PHOENIX AppImage.

The old `.deb` packager remains a frozen fallback (`installer:deb`, `installer:deb:verify`),
not a release asset. The existing v0.1.3 draft still contains that older format; do not reuse or
move its tag to publish the AppImage. Start a new release after the normal checked promotion.

## Windows x64 test installer

Use an x64 Windows host with Node.js 24.14+, Visual C++ Build Tools with the x64 C++ toolchain, and
Inno Setup 6 or 7:

```powershell
npm.cmd ci
npm.cmd run installer:windows
npm.cmd run installer:windows:verify
```

Set `INNO_SETUP_COMPILER` to the full path of `ISCC.exe` when Inno Setup is outside its standard
installation directory. The build compiles the native tray launcher and writes
`dist/installer/PHOENIX-<version>-windows-x64-setup.exe`. The per-user installer provides Start-menu
and optional desktop shortcuts, console-free background launch, duplicate-instance protection, and
tray open/quit controls.

The verifier silently installs into an isolated directory, verifies the installed payload,
exercises the native launcher, duplicate launch, clean stop, and writable user-state boundary, then
runs the uninstaller. Automated native launches use `Phoenix.exe --non-interactive` to suppress
blocking error dialogs (including the intentional corrupt-settings case); failures still return
nonzero and write the launcher log. Normal launches retain their error dialogs.
Windows game input still requires a separate real Elite validation; an
installer smoke test cannot prove `SendInput` behavior.

## CI and draft releases

`CI` checks Linux and Windows on pushes/PRs to `dev` and `main`. Promotion to `main` also verifies
both native installers. `Draft release` validates version tags on `main`, builds verified installers
and checksums, and creates a draft preview release. It never publishes automatically. Only release
builds upload intermediate artifacts, with one-day retention; ordinary CI retains none.

See [the release workflow](../../docs/releases.md) for branching, approval, permanent download
links and the native local-build fallback if Actions storage or runners are unavailable.

## Current-build Windows acceptance

The development host is Linux; native Windows build/installer verification runs in GitHub
Actions. Check the [CI and release runs](https://github.com/judus/phoenix/actions) for the exact
revision being evaluated. A green check proves the automated gates below, not live gameplay:
CI smoke tests use simulated input, not Elite. Historical Windows/Elite success does not
replace acceptance of the current release. No real Windows/Elite test session is available
for the 2026-10-04 release-pipeline setup.

For the exact revision intended for release, record the commit, Windows/Node/toolchain versions,
artifact SHA-256 and results of these gates:

- Run `npm.cmd ci`, `npm.cmd run check`, `npm.cmd run installer:windows` and
  `npm.cmd run installer:windows:verify` on native x64 Windows (or use the native workflow's
  equivalent gates). Preserve the artifact and its payload manifest.
- On a real Windows machine, verify install, upgrade, tray open/quit, duplicate launch,
  failed-start recovery, restart and uninstall. Existing settings, pairing, macros, projects
  and reconstructed commander data must survive upgrade/restart/uninstall as documented;
  do not delete player data for the test.
- Verify LAN/firewall onboarding and QR pairing from a separate tablet/browser device,
  including automatic pairing-code claim and reconnect after restart.
- With Elite **focused**, trigger one safe known-good binding and one formerly failing
  binding from the paired device. Historically these were night vision (`N`) and Galaxy Map
  (`G`); use the actual current bindings. Record resolved chord, operation and in-game result.
  Test press/release, macro stop/cancel/failure cleanup and clean application shutdown without
  leaving held keys. Accepted API responses or Notepad typing are not Elite validation.
- Recheck real route plotting, including the current map zoom holds and success/timeout
  cleanup, and journal, Status, bindings, NavRoute, Ship Locker and Backpack discovery.
- Record antivirus/SmartScreen results and the signing/distribution decision before a public
  release. Do not represent a successful unsigned CI installer as certified gameplay support.

Real Elite/input acceptance remains **pending**, not failed, until recorded on a Windows
machine running the game. Release manifests and checksums identify the exact automated build;
retain the manual acceptance evidence alongside that release before publishing it.
