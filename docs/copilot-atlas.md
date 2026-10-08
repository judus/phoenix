# Copilot and the Galactic Atlas

Two Display capabilities navigate PHOENIX's Atlas, not Elite Dangerous's in-game Galaxy Map:

- `display.open_page({ "page": "galaxy.atlas" })` opens the page normally.
- `display.show_galactic_atlas({ "systemName": "Colonia" })` resolves the system through
  PHOENIX's existing cartography service, centres the Atlas and opens its location inspector.
  Omit `systemName` to use the current system. Community Goal, GalNet lead and bookmark
  destinations can supply the system name; the tool selects the system, not a particular
  source marker or activity. It does not change source-layer visibility or filter settings.

Coordinates are never LLM arguments. Missing coordinates produce corrective tool feedback
without navigating. Provider failures retain their existing error classification. Display
requests use the existing event stream and respect each device's “follow Copilot navigation”
setting. A fresh request ID allows showing the same destination again after manual panning.
The destination survives the normal route hash and workspace history; later telemetry or
catalogue updates do not re-centre the map.

The new capability appears in the **Display** permission group. Fresh installations include it
in the default installation policy. Existing installation/profile allowlists are not expanded:
enable **Show Galactic Atlas** in the installation's AI tools settings and in the Copilot
profile's permissions before asking the profile to use it.
