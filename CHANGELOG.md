# Changelog

Player-visible changes are recorded here. Unreleased entries are not available in an installer yet.

## Unreleased

- Restore workspace swipes across page and table scroll surfaces; CTR and CPT now remember
  their last pages, while a first visit to CTR uses the first configured deck.
- Allow workspace swipes starting on ordinary control-deck tap buttons without firing commands;
  retain protected hold/arming buttons and edit-mode dragging.
- Retain journal system coordinates for Atlas bookmarks, including visited systems absent from
  EDSM; rebuild retained coordinates from journals and distinguish lookup errors from unknown positions.
- Atlas selection details use a side panel (below the map on narrow screens); system names link
  directly to their schematics, with a compact current-position footer.
- Align cartography sidebars with a subtle gradient and map/panel spacing; tap empty Atlas map
  space to dismiss selection, retaining panels while panning or pinching.
- Galaxy opens on the Atlas, initially centred and zoomed around your position. Remove the
  redundant Whole galaxy/Locate me buttons; keep keyboard Home for the whole-galaxy view.
- Move fleet-carrier visibility into the schematic header and give carriers a distinct shared icon.
- Preview previously visited systems in a plotted route without changing in-game targeting.
- Add compact blueprint search and saved-query text/type filters; use display labels for effects.
- Show the commander dashboard log newest first, without scrolling to the oldest entry.
- Put Projects last in Engineering and Equipment navigation, using PRJ for both.
- Open the active Copilot profile editor immediately; keep manual selection and unsaved edits safe.
- Inset dropdown chevrons, reduce the visible edit grip without shrinking its touch target, and
  show Numpy cancellation keys beneath a Cancel label.
- Remove the Module Health threshold count; retained conditions remain explicitly last reported.

## 0.1.5 — 2026-10-05 (prerelease)

- Move individual Control Deck buttons to empty slots or swap occupied slots in edit mode.
- Numpy follows saved deck order: Quick access starts at 011, Ship at 012. Macros are reachable
  through their assigned deck buttons, not a separate generated address.
- Rapid Numpy entry no longer waits for intermediate views to render, including cold console opens.
- Restore README screenshots and add direct Windows installer and Linux AppImage download links.

Earlier preview details are available in [GitHub Releases](https://github.com/judus/phoenix/releases).
