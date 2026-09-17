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
