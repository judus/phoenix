# Embedded Control Deck artifacts

The JavaScript runtime is now `control-deck-phoenix-runtime-0.1.12.tgz`, built with
`npm run package:phoenix` in the owning repository. It adds the render-independent Numpy input
controller, including bounded cold-start buffering and stale-completion protection.
The native Linux helper remains at 0.1.10; its input behavior is unchanged. The npm lockfile pins
the runtime archive integrity. No standalone Control Deck UI is bundled in this runtime.

The JS runtime is consumed through the existing locked npm dependency. The Linux AppImage also
uses `control-deck-phoenix-linux-helper-0.1.10-x64.tgz`, a narrow native artifact containing only
the Wayland keymap reader, its manifest and the PHOENIX Runtime Licence. It does not include or
grant rights to the standalone Control Deck launcher/application/source.

Built in the owning Control Deck repository with `node scripts/package-phoenix-linux-helper.mjs`
from its unchanged `apps/control-deck-launcher/linux/wayland-keymap-reader.c`. The artifact manifest
records source commit/hash, compiler, Wayland client version and file hashes. The outer archive
hash is pinned in `scripts/package/appimage-resources.json`; PHOENIX verifies both layers.

Initial build: Control Deck 0.1.10, Linux Mint 22 / Ubuntu noble toolchain, Wayland 1.22.0.
`readelf --version-info` confirms a highest required glibc symbol version of GLIBC_2.34.
Dynamic dependency `libwayland-client.so.0` is supplied by the user's desktop, not this artifact.
No private repository credentials, sibling checkout or C compiler are required to build PHOENIX.

To update, change/test the helper at its owner, create a new versioned binary artifact there,
replace this archive and its hash, then run PHOENIX AppImage verification plus real desktop input
acceptance. Do not copy the C source into PHOENIX or silently replace an existing release artifact.
