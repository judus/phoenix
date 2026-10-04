# Payload and installer tooling

PHOENIX packages are host-native. Build Linux installers on Linux x64 and Windows installers on
Windows x64; the Windows package embeds the host Node runtime and compiles a native tray launcher,
so it cannot be produced correctly from Linux.

## Storefront-neutral payload

`npm run payload:build` creates a platform-specific payload under `dist/payload/`. It contains
compiled application code, curated resources, production dependencies, and the Node runtime
executing the build.

`npm run payload:verify` checks every staged file against `manifest.json`. `npm run payload:smoke`
starts a temporary copy in installed mode and verifies that mutable state is written to isolated
platform user directories. Linux additionally makes the temporary installation read-only.
The smoke test also checks duplicate launch, clean stop, retained pairing/profile data across
restart, a version-two settings migration that preserves customization, and failed startup with
corrupt settings followed by recovery. It removes developer PHOENIX path/provider overrides from
the child environment and uses an empty Elite directory and simulated input backend. It never
repairs or resets the player's configuration.

## Linux x64 test installer

On a Debian-family build host with `dpkg-deb` available:

```sh
npm ci
npm run installer:linux
npm run installer:linux:verify
```

The build wraps the current Linux payload in `dist/installer/phoenix_<version>_amd64.deb`. It
installs immutable application files under `/opt/phoenix`, provides `/usr/bin/phoenix`, and
registers a no-terminal desktop launcher. The verifier extracts the generated package, checks its
metadata, launcher, desktop entry, runtime permissions, and payload checksums, then runs the
installed-mode smoke test against the extracted package.

`xdg-utils` opens the local application in the default browser. `xdotool` is recommended for Elite
input on X11 or XWayland. Native Wayland input uses `xkbcli` and the desktop's XDG RemoteDesktop
portal implementation.

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
runs the uninstaller. Windows game input still requires a separate real Elite validation; an
installer smoke test cannot prove `SendInput` behavior.

## Optional GitHub Actions proof

The manual `Payload proof` workflow runs the checks and native installer build on Linux and Windows.
It uploads the two installers as seven-day engineering artifacts, not public releases. GitHub
Actions is optional: use the local commands above when Actions minutes or artifact storage are
constrained. Check account-level Actions usage before dispatching the workflow because repository
artifact and cache listings do not expose the complete account quota.

These remain test installers rather than public releases.

## Current-build Windows acceptance

As of 2026-10-04, the development host is Linux and no native Windows device/session is
available for this pass. Historical GitHub Actions Windows builds and real Windows/Elite use
were successful; that is not fresh acceptance of the current source revision. The existing
manual workflow already runs native Windows checks, builds the installer, and verifies its
installed launcher. It remains a viable build alternative, but no fresh run was dispatched
and the earlier account-level Actions quota warning is unresolved. Check usage and obtain
authorization before dispatching. CI smoke tests use simulated input, not Elite.

For the exact revision intended for release, record the commit, Windows/Node/toolchain versions,
artifact SHA-256 and results of these gates:

- Run `npm.cmd ci`, `npm.cmd run check`, `npm.cmd run installer:windows` and
  `npm.cmd run installer:windows:verify` on native x64 Windows (or use the manual workflow's
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

Native build/installer checks and real Elite acceptance are **pending**, not failed. Windows
builds may be obtained through an authorized Actions run without a local Windows build host;
live Elite/input acceptance still requires access to a Windows machine running the game.
