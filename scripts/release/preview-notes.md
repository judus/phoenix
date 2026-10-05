## Preview installers

PHOENIX is under active development. Back up your PHOENIX user data before testing an upgrade.

- Windows x64: download `PHOENIX-windows-x64-setup.exe`. This installer is unsigned; Windows
  may show an unknown-publisher/SmartScreen warning. Do not disable security protections.
- Linux x64: download `PHOENIX-linux-x64.AppImage`, mark it executable and launch it. Targets
  modern glibc-based desktops (glibc >= 2.34); see the packaging guide for required desktop libraries.
  X11 helpers and the Wayland keymap reader are bundled; Wayland needs a keyboard-capable
  RemoteDesktop portal. Quit with the same image's `--stop` option before replacing/removing it.
- Git and Node.js are not required for these installers. The runtime and a starter catalogue
  are bundled; catalogue refreshes and online queries need internet access. Optional Copilot use requires your own
  provider credentials and may incur provider charges.
- `SHA256SUMS` and platform build manifests identify the exact assets, source commit and runtime.
  Checksums detect changed downloads; they are not a replacement for publisher code signing.
- EDDN production uploads remain gated off. These installers do not enable test submissions.

Automated checks verify Linux AppRun and the AppImage's extract-and-run lifecycle,
and install/launch/shutdown/uninstall on Windows
using simulated input.
They do not establish real Elite input, tablet pairing, FUSE mounting, desktop portal,
antivirus or upgrade acceptance. Control Deck's earlier Linux tests are not PHOENIX AppImage acceptance.

## Maintainer approval before publishing

- [ ] Review Windows and Linux native build/installer checks for this exact tag.
- [ ] Exercise real installation/upgrade, retained user data, LAN pairing and Elite controls.
- [ ] Review unsigned Windows warnings, known limitations and these release notes.
- [ ] Publish deliberately as a preview; do not mark an unvalidated build as stable/latest.
