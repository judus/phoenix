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

Text conversations belong to the application session, not the mounted chat page. Display-tool
navigation and manual workspace switching can unload the page without cancelling a turn or
discarding messages. Returning shows the same pending exchange; completion refreshes the saved
history. Application disposal or replacement still aborts its requests. History snapshots received
before a local turn completes cannot overwrite that turn's optimistic messages.

The chat view initially renders only the latest 30 messages; the full conversation remains in
the session and model history. “Load older messages” reveals earlier batches while preserving
the current reading position. Incoming text follows the bottom only when the reader is there.

The new capability appears in the **Display** permission group. Fresh installations include it
in the default installation policy. Existing installation/profile allowlists are not expanded:
enable **Show Galactic Atlas** in the installation's AI tools settings and in the Copilot
profile's permissions before asking the profile to use it.

## Plotting a route in Elite

`navigation.plot_route({ "systemName": "Colonia" })` runs the same game-input routine as
the system schematic's **Plot route** button. Unlike the Display tools above, it operates
Elite's Galaxy Map; Elite calculates the route. The game must be running and focused, with
the required keyboard bindings. Invoke it only on an explicit request to plot a route.

Enable **Plot route** under the installation's **Galaxy** AI tools and in the active Copilot
profile. It is intentionally not enabled by default, and existing allowlists are not expanded.
Text, MCP and realtime voice share this permission check and the existing destination service.

The result retains `status`, `phase`, `requestedSystem`, `confirmedSystem`, `message` and any
`bindingWarnings`. Only `confirmed` establishes that Elite reported a new route ending at the
requested system. A `rejected`, `failed` or `timed_out` result must not be presented as success
or retried automatically: some game input may already have been sent. Cancellation propagates
to the existing routine. Copilot tool execution/transport allow 60 seconds so the routine can
finish its bounded map and route acknowledgements instead of being cut off after 30 seconds.
