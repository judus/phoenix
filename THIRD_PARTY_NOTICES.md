# Third-party data notices

## Elite Dangerous game data

PHOENIX can fetch and locally normalize ship, module, and engineering catalogue data from community-maintained Elite Dangerous data projects:

- [EDCD Coriolis Data](https://github.com/EDCD/coriolis-data), for ship and engineering-blueprint data;
- [EDCD FDevIDs](https://github.com/EDCD/FDevIDs), for ship, outfitting, material, and engineer identifiers;
- [EDSM](https://www.edsm.net/), for resolving engineer-system names and coordinates.

PHOENIX does not distribute those upstream catalogue snapshots. The fetcher stores them in the user's writable runtime-data directory. Exact upstream revisions and refresh timestamps are recorded in that local snapshot's `manifest.json`.

The Coriolis Data license states that its Elite Dangerous data and associated JSON files are intellectual property and copyright of Frontier Developments plc and are subject to Frontier's terms and conditions. The MIT grant in that repository applies to Coriolis-specific code, not the game data.

Elite Dangerous, its names, identifiers, and game data are trademarks or intellectual property of Frontier Developments plc. PHOENIX is an unofficial fan-made companion project and is not endorsed by or affiliated with Frontier Developments.

PHOENIX records the source and revision of each locally fetched catalogue where that information is available. Locally inferred display labels are marked as inferred rather than attributed to either catalogue.
