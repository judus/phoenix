# Third-party notices

## Galactic atlas region map

The bundled region geometry and coordinate lookup are derived from
[EliteDangerousRegionMap](https://github.com/klightspeed/EliteDangerousRegionMap), revision
`6c1191a58e1e593966f44f16235ab39d1ad24d84`, MIT licensed, Copyright (c) 2020 Ben Peddell.
The full licence is included in `licenses/EliteDangerousRegionMap.txt`.
`scripts/catalogue/build-galactic-atlas.mjs` regenerates the data: contours are simplified for
display while region lookup retains the original grid. No upstream styles or executable scripts
are loaded in the browser. Region classification follows physical coordinates, not the potentially
different system-boxel region recorded by the Codex.

The small landmark coordinate list was verified against EDSM's `api-v1/systems` endpoint on
2026-10-03. Nebula markers identify reference systems, not measured nebula boundaries. The Bubble
is anchored at Sol; no territorial or population boundary is asserted. Elite Dangerous names and
game data remain subject to Frontier's rights, as described below.

## Control Deck PHOENIX runtime

Official PHOENIX builds include a purpose-built compiled subset of Control Deck. It is not licensed
under the Apache License 2.0 and it does not include the standalone Control Deck application. The
runtime may be used and redistributed, without modification, only as an embedded component of
PHOENIX or a genuine PHOENIX derivative under the conditions in its own licence.

Redistributions containing the runtime must be available without charge. Voluntary donations or
sponsorship are permitted when payment is not tied to access, use, features, or updates. Commercial
redistribution requires separate written permission from the Control Deck copyright holder.

Source checkouts carry the complete runtime licence and its third-party notices inside the vendored
runtime package. Installed payloads expose copies under `licenses/`.

## Linux AppImage components

PHOENIX's Linux tray uses `dbus-native` 0.15.2 (MIT) and its dependencies. Their complete licence
texts are shipped in `licenses/Control-Deck-Third-Party-Notices.md`, since the same libraries are
also included in the embedded runtime. The tray implementation itself belongs to PHOENIX.

PHOENIX AppImages also embed a separately versioned, unmodified Control Deck Wayland keymap
reader under the same PHOENIX Runtime Licence; see `vendor/control-deck/README.md` for provenance.
The standalone Control Deck application and launcher are not included.

The AppImage type-2 runtime (revision `caf24f9f712084686bfc24a70b75e50df0aefb9c`) and
xdotool/libxdo 3.20160805.1-4 retain their own licences. Complete upstream notices are included
in `licenses/AppImage-THIRD-PARTY-NOTICES.md`; URLs and binary/runtime hashes are pinned in
`scripts/package/appimage-resources.json`. The build tool itself is not part of the shipped image.

## IBM Plex Sans font

PHOENIX bundles the IBM Plex Sans variable font by IBM Corp. IBM Plex Sans is licensed under the SIL Open Font License, Version 1.1. The copyright notice and complete license are included in `licenses/IBMPlexSans-OFL.txt`.

## Euro Caps font

PHOENIX bundles the Euro Caps font by Tom Oetken, published as Ash Pikachu Font. The original font file is distributed by DaFont as “100% Free”: <https://www.dafont.com/euro-caps.font>.

## Elite Dangerous game data

PHOENIX can fetch and locally normalize ship, module, and engineering catalogue data from community-maintained Elite Dangerous data projects:

- [EDCD Coriolis Data](https://github.com/EDCD/coriolis-data), for ship and engineering-blueprint data;
- [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), for ship, outfitting, material, and engineer identifiers;
- [EDSM](https://www.edsm.net/), for resolving engineer-system names and coordinates;
- [Elite Dangerous Almanac](https://github.com/DarkSession/Elite-Dangerous-Almanac), for a pinned personal-equipment, upgrade-recipe, modification, and micro-resource source revision. The Almanac repository is licensed under AGPL-3.0-or-later and identifies Odyssey Materials Helper as the upstream recipe lineage.

PHOENIX does not distribute those upstream catalogue snapshots. The fetcher stores them in the user's writable runtime-data directory. Exact upstream revisions and refresh timestamps are recorded in that local snapshot's `manifest.json`.

The Coriolis Data license states that its Elite Dangerous data and associated JSON files are intellectual property and copyright of Frontier Developments plc and are subject to Frontier's terms and conditions. The MIT grant in that repository applies to Coriolis-specific code, not the game data.

Elite Dangerous, its names, identifiers, and game data are trademarks or intellectual property of Frontier Developments plc. PHOENIX is an unofficial fan-made companion project and is not endorsed by or affiliated with Frontier Developments.

PHOENIX records the source and revision of each locally fetched catalogue where that information is available. Locally inferred display labels are marked as inferred rather than attributed to either catalogue.

## JSONC Parser

PHOENIX's catalogue refresh utility includes `jsonc-parser` by Microsoft to read the pinned Almanac source documents. It is licensed under the MIT License. The complete license is included in `licenses/jsonc-parser-MIT.txt`.
## EDDN contribution dependencies

PHOENIX includes the EDDN journal/1, commodity/3, outfitting/2 and shipyard/2 JSON schemas
from EDCD/EDDN revision `4ad669bb7bbe1eae080e4c354e786dca4db91f35`, copyright (c) 2018 EDDN,
under BSD-3-Clause. See `licenses/EDDN-BSD-3-Clause.txt` and `resources/eddn/README.md`.
Schema validation uses Ajv and ajv-draft-04 (MIT); notices are included in `licenses/`.
