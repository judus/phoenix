# Third-party notices

## Android shell

The optional Android wrapper uses [AndroidX](https://developer.android.com/jetpack/androidx),
[ZXing Android Embedded](https://github.com/journeyapps/zxing-android-embedded/tree/v4.3.0)
and [ZXing Core](https://github.com/zxing/zxing/tree/zxing-3.4.1), under Apache-2.0.
AndroidX also includes the Kotlin standard library and kotlinx.coroutines under Apache-2.0.
These are Android-only dependencies, not part of desktop installers. Attribution notices and
the complete Apache-2.0 licence are bundled in the APK's `assets/licenses/` directory.

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

## Atlas POI services

Atlas POIs are retrieved from the Galactic Exploration Catalog (GEC), by CMDR Orvidius and its
community contributors, and Canonn Research Group's public Guardian feeds. GEC content retains
its [CC BY-NC-SA 3.0 licence](https://edastro.com/gec/APIinfo), separate from PHOENIX's source licence.
External datasets are cached in user data, not bundled. Canonn map-code licensing is not asserted
as the licence of its external feeds. No source imagery, article text or remote executable code is
included. Source attribution and links accompany the records. See `resources/atlas/README.md`.

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
- [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), for ship, outfitting, commodity, material, and engineer identifiers;
- [EDSM](https://www.edsm.net/), for resolving engineer-system names and coordinates;
- [Elite Dangerous Almanac](https://github.com/DarkSession/Elite-Dangerous-Almanac/tree/362210e98b334cd7575d0734301c66c8bd2d17bd), for a pinned personal-equipment, upgrade-recipe, modification, specialist and micro-resource source revision. Its code and documentation are MIT-licensed; game data remains under source-specific terms, not relicensed under MIT. See the pinned [licence](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/362210e98b334cd7575d0734301c66c8bd2d17bd/LICENSE) and [attributions](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/362210e98b334cd7575d0734301c66c8bd2d17bd/ATTRIBUTIONS.md).
- [Odyssey Materials Helper](https://github.com/jixxed/ed-odyssey-materials-helper), by Jixxed, for the upstream personal-equipment identities and upgrade/modification recipes used through the Almanac. Its MIT notice is included in `licenses/OdysseyMaterialsHelper-MIT.txt`.

PHOENIX bundles normalized starter catalogue snapshots in `resources/catalogue`, including in installed payloads. The refresh utility stores refreshed snapshots in the user's writable runtime-data directory. Source revisions and refresh timestamps are recorded in the catalogue manifest and domain-specific provenance. These are game-data snapshots, not copies of upstream application code, and remain subject to the relevant source terms. The Almanac's full licence, including its game-data caveat, is included in `licenses/EliteDangerousAlmanac.txt`.

The Coriolis Data license states that its Elite Dangerous data and associated JSON files are intellectual property and copyright of Frontier Developments plc and are subject to Frontier's terms and conditions. The MIT grant in that repository applies to Coriolis-specific code, not the game data.

Elite Dangerous, its names, identifiers, and game data are trademarks or intellectual property of Frontier Developments plc. PHOENIX is an unofficial fan-made companion project and is not endorsed by or affiliated with Frontier Developments.

PHOENIX records the source and revision of each locally fetched catalogue where that information is available. Locally inferred display labels are marked as inferred rather than attributed to either catalogue.

## Live services and research references

PHOENIX uses [EDSM](https://www.edsm.net/) for cartography, coordinates and station shipyard/outfitting stock,
[Spansh](https://spansh.co.uk/) for structured galaxy searches, and [Ardent Insight](https://ardent-insight.com/)
for nearest facilities, commodity markets and trade signals. These services and their community contributors
retain their own data/API terms; their reports can be incomplete or stale.

[Inara's experimental-effects registry](https://inara.cz/elite/experimentaleffects/) was used to cross-check
and correct material recipes imported from Coriolis. The review and corrections are recorded in
`scripts/catalogue/experimental-effects.md`; PHOENIX does not connect to an Inara API.
[PMC's Stratum search guide](https://www.elitedangerous.net/exobiology-stratum-tectonicas-search.php)
inspired the pre-Odyssey saved-query strategy. PHOENIX uses independently corrected filters, not copied guide text
or a guarantee of undiscovered biology.

[Elite Dangerous Wiki](https://elite-dangerous.fandom.com/wiki/Elite_Dangerous_Wiki) is a community-maintained
research reference used to cross-check biological habitats and game mechanics. It is not a live data
connection; PHOENIX does not bundle wiki article text.

## Deskplane

[Deskplane](https://github.com/judus/deskplane) provides workspace navigation and touch gestures,
under the MIT licence. Its complete notice is included in `licenses/Deskplane-MIT.txt`.

## JSONC Parser

PHOENIX's catalogue refresh utility includes `jsonc-parser` by Microsoft to read the pinned Almanac source documents. It is licensed under the MIT License. The complete license is included in `licenses/jsonc-parser-MIT.txt`.
## EDDN contribution dependencies

PHOENIX includes sixteen EDDN validation schemas, including journal/1, commodity/3, outfitting/2 and shipyard/2,
from EDCD/EDDN revision `4ad669bb7bbe1eae080e4c354e786dca4db91f35`, copyright (c) 2018 EDDN,
under BSD-3-Clause. See `licenses/EDDN-BSD-3-Clause.txt` and `resources/eddn/README.md`.
Schema validation uses Ajv and ajv-draft-04 (MIT); notices are included in `licenses/`.

[EDMarketConnector](https://github.com/EDCD/EDMarketConnector), revision
`89f410c9c75c16ff564068ab5201ed3d65ba68ce`, is a behavioural reference for EDDN event mapping
and privacy rules. No EDMC source or implementation is copied or bundled. Contribution availability
and settings are separate from these protocol credits; this notice does not claim live submission readiness.
