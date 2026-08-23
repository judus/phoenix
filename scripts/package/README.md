# Payload tooling

`npm run payload:build` creates a platform-specific, storefront-neutral PHOENIX payload under `dist/payload/`. It contains compiled application code, curated resources, production dependencies, and the Node runtime executing the build.

`npm run payload:verify` checks every staged file against `manifest.json`. `npm run payload:smoke` starts a temporary copy in installed mode and verifies that mutable state is written to isolated platform user directories. Linux additionally makes the temporary installation read-only.

The manual `Payload proof` GitHub Actions workflow runs this sequence on Linux and Windows and uploads short-lived artifacts. These artifacts are engineering evidence, not public releases or installers.

`npm run installer:linux` wraps the current Linux payload in a Debian/Ubuntu test installer. It installs immutable application files under `/opt/phoenix`, provides `/usr/bin/phoenix`, and registers a no-terminal desktop launcher. `xdg-utils` opens the local application in the default browser; `xdotool` is recommended for Elite input on X11 or XWayland. Native Wayland input is not yet available.

`npm run installer:linux:verify` extracts the generated `.deb`, checks its metadata, launcher, desktop entry, runtime permissions, and payload checksums, then runs the installed-mode smoke test against the extracted package. These remain test installers rather than public releases.

On x64 Windows, `npm run installer:windows` compiles the native tray launcher and wraps the Windows payload with Inno Setup. It produces a per-user installer with Start-menu and optional desktop shortcuts, a console-free background launch, duplicate-instance protection, and tray open/quit controls. Visual C++ Build Tools and Inno Setup 6 or 7 are build-time dependencies only. Set `INNO_SETUP_COMPILER` when `ISCC.exe` is outside its standard installation directory.

`npm run installer:windows:verify` silently installs into an isolated directory, verifies the installed payload, exercises the native launcher, duplicate launch, clean stop, and writable user-state boundary, then runs the uninstaller. Windows game input still requires a separate real Elite validation; an installer smoke test cannot prove `SendInput` behavior.
