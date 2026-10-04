## Preview installers

PHOENIX is under active development. Back up your PHOENIX user data before testing an upgrade.

- Windows x64: download `PHOENIX-windows-x64-setup.exe`. This installer is unsigned; Windows
  may show an unknown-publisher/SmartScreen warning. Do not disable security protections.
- Debian/Ubuntu-family Linux x64: download `PHOENIX-linux-x64.deb`. This is not a universal
  Linux package. Desktop input helpers and portal support depend on your desktop environment.
- Git and Node.js are not required for these installers. The runtime is bundled. First launch
  needs internet access to obtain game catalogues. Optional Copilot use requires your own
  provider credentials and may incur provider charges.
- `SHA256SUMS` and platform build manifests identify the exact assets, source commit and runtime.
  Checksums detect changed downloads; they are not a replacement for publisher code signing.
- EDDN production uploads remain gated off. These installers do not enable test submissions.

Automated native checks verify build/install/launch/shutdown/uninstall paths using simulated input.
They do not establish real Elite input, tablet pairing, antivirus or upgrade acceptance.

## Maintainer approval before publishing

- [ ] Review Windows and Linux native build/installer checks for this exact tag.
- [ ] Exercise real installation/upgrade, retained user data, LAN pairing and Elite controls.
- [ ] Review unsigned Windows warnings, known limitations and these release notes.
- [ ] Publish deliberately as a preview; do not mark an unvalidated build as stable/latest.
