# Atlas POI sources

`known-sites.json` contains separately verified factual destinations, not copied article text or
images. Jameson's crash-site body and **Live/4.0** surface coordinates come from
[Canonn](https://canonn.science/codex/cmdr-john-jameson-crashed-cobra-mkiii/); HIP 12099's galactic
coordinates were checked against EDSM's `api-v1/system` on 2026-10-06. Legacy coordinates are
different and are not substituted for Live.

The server retrieves the [GEC API](https://edastro.com/gec/APIinfo) and the public Guardian feeds
used by [Canonn's map](https://github.com/canonn-science/CanonnED3D-Map) only when the Atlas is
opened. Normalized records and retrieval timestamps are cached independently in the existing
SQLite provider cache for 24 hours; failed refreshes retain last-good data and show source status.
No provider requests occur per marker or during application startup. Invalid/duplicate records
are counted, not silently mapped to Sol. A wholly invalid/empty feed cannot erase retained data.

GEC content is CC BY-NC-SA 3.0, not Apache-licensed PHOENIX code. Canonn's map-code MIT licence
is not asserted as the licence of its external data feeds. Those datasets are not bundled or
committed; no remote scripts, HTML descriptions, images or contributor identities are imported.
Record identities, source names and links survive normalization. GEC categories are retained;
the Guardian feeds retain their own Structures/Ruins/Beacons identities and site types.

The current Guardian feeds provide body names and system coordinates, but no surface coordinates.
Missing coordinates are not inferred from old layouts or from the system's galactic position.
Different POIs in the same system stay independently selectable; screen-space clustering is a
presentation operation, not destructive catalogue deduplication.

The older combined GEC/GMP feed is intentionally excluded: it contains route/region geometries
and a separate historical taxonomy, not just additional individual destinations. GalNet intelligence
is independently deferred in issue #60.
