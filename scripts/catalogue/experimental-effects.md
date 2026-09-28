# Experimental recipe import

Compatibility and canonical effect identifiers come from the pinned EDCD
Coriolis snapshot: modifications/modules.json and modifications/specials.json.
Source revision and retrieval time are stored in engineering/experimental-effects.json.
Never resolve a recipe by display name alone: Flow Control, Stripped Down and
other shared names have module-specific recipes.

Recipe audit (2026-09-27): compared every referenced, non-legacy, nonempty
Coriolis recipe with https://inara.cz/elite/experimentaleffects/ .
Eight discrepancies are explicitly corrected in the importer:

| Canonical effect | Correction |
| --- | --- |
| special_armour_explosive | Niobium 3 → 1 |
| special_thermal_vent | Conductive Components → Conductive Polymers (3) |
| special_weapon_lightweight | Carbon 3 → 5 |
| special_shield_regenerative | Compound Shielding 3 → 1 |
| special_shield_kinetic | Flawed Focus Crystals 5 → 3 |
| special_blinding_shell | Add Mechanical Components (5) |
| special_drag_munitions | Molybdenum 5 → 2 |
| special_screening_shell | Niobium 2 → 3 |

Also normalize the upstream spelling “Adaptive Encyptors Capture” to
“Adaptive Encryptors Capture” and tolerate surrounding whitespace in material names.
Ion Disruptor could not be corroborated and is excluded. Legacy-labelled effects
and effects without recipes are excluded rather than treated as free.
These are third-party recipes, not an in-game validation; re-audit when sources change.

Project steps store exact effect symbol, selected compatible module ID, application
count and a snapshot of material requirements. One application is one module.
No grade multiplier or lower-grade roll accumulation applies. Existing blueprint
steps remain readable without migration; older application versions may not read
projects containing experimental steps. An older catalogue without the new file
loads safely with no experimental effects; refresh the catalogue and restart.
