# Copilot tool error contract

All 36 tools registered by `createPhoenixMcpTools` share the same public error boundary.
Their JSON schemas are validated by `@jdu/llm-client`'s `ToolRegistry` before handlers run.
The same definitions and handlers serve text/MCP and Realtime voice.

## Errors and recovery

- Schema mistakes identify the invalid field and allowed shape through `ToolUsageError`.
- Expected argument and domain-precondition errors use `ToolArgumentError(problem,
  correction)` when the registered tool supplies its name, or `ToolUsageError(toolName,
  problem, correction)` when the application operation owns a specific tool identity.
- `retryable: false` on usage errors means corrected arguments are required. It does not
  forbid a corrected follow-up call or authorize retries of side effects.
- Public provider, configuration, permission, timeout, cancellation and malformed-response
  errors use `AiError` and retain their category. Do not infer these from exception text.
- Spansh, Ardent and EDSM adapters report typed `ProviderQueryError` failures. The shared
  transport distinguishes HTTP/access/rate limits, network/timeouts and malformed responses;
  the tool boundary maps these to safe categories without URLs or response bodies. A missing
  provider record offers lookup guidance, not an automatic substitute or unchanged retry.
  Other permanent HTTP 4xx rejections are non-retryable provider-request errors: do not
  tell the model to repeat an unchanged rejected request later.
- Unexpected exceptions remain `tool_execution` failures. Their original diagnostics are
  retained as a local cause, while model-facing text contains no original exception, stack,
  credentials or argument values. They do not invite guessed argument changes or retries.
- Failed controls are errors rather than successful tool outputs. Rejected permissions
  require a user Settings change. Timeout/failure/cancellation may follow dispatched input,
  so the model must not repeat the operation without a new user request. Accepted but
  unconfirmed input remains an honest outcome; it is not confirmation of the game state.
- Empty results, missing observed inventory, unknown jump range and unavailable current-body
  observations remain valid data results when the tool can describe that uncertainty.

Only intentionally public messages may be used in `AiError` or `ToolArgumentError`.
Never insert raw supplied values, upstream response bodies, secrets, stacks or diagnostic
causes into public messages or error details. A known public message may pass through the
shared boundary; an arbitrary `Error` must not be reclassified as a usage error.

## Handler audit

| Tools | Handler and error responsibility |
| --- | --- |
| `commander.get_current_situation`, `ship.get_current_ship_status`, `ship.get_cargo_manifest`, `ship.list_installed_modules`, `engineering.list_material_inventory` | Local observed state; unknown observations and empty filtered results are data. Common argument parser errors receive correction hints. |
| `equipment.get_equipment_report`, `comms.list_messages`, `missions.list_missions`, `fleet.list_owned_ships`, `fleet.list_stored_modules`, `engineering.list_engineers` | Local read models; typed argument errors are corrected, unexpected repository errors stay internal. |
| `controls.find_actions` | Read-only discovery; empty matches do not authorize execution. |
| `controls.execute_command` | Macro operation and press/release lease combinations validate before dispatch. Gateway rejection/failure/cancellation/timeout retain distinct safe outcomes. |
| `controls.set_control_state` | Capability checks precede state changes. Permission failures require the user to change Settings; execution failures never imply that retrying is safe. |
| `ships.get_ship_definition`, `ships.compare_ship_definitions` | Unknown hull identifiers and invalid comparison cardinality give correction instructions without echoing argument values. |
| `display.open_page`, `display.show_body_details`, `display.show_system_schematic` | Display application owns valid page resolution and explicit/current-system preconditions. |
| `navigation.check_jump_reachability`, `navigation.get_plotted_route` | Unknown position/range and absent route are valid uncertainty. Cartography failures remain provider/internal failures. |
| `exploration.get_current_body_signals` | Absent current body is a valid observation result. |
| `exploration.find_exploration_targets` | Exploration application owns date, physical-range and reference-system checks; source owns provider failures. |
| `factions.find_faction_presence`, `systems.get_system_details`, `systems.find_systems` | Application owns reference-system and mutually compatible filter checks; providers own public service failures. |
| `markets.find_commodity_markets`, `markets.find_trade_opportunities` | Station/market application owns intent, origin and filter checks; absence of matching markets is valid data. |
| `stations.find_stations_selling_module`, `stations.find_shipyards_selling_ship`, `stations.find_nearest_service` | Station application owns supported module/service/reference arguments; freshness and no matching stock remain ordinary results. |
| `stations.get_station_details`, `stations.list_shipyard_stock`, `stations.find_stations_by_name`, `stations.list_outfitting_stock` | Station application owns required reference and ambiguous station correction; never select a suggested station silently. |
| `web.search_web` | Non-empty bounded query with typed correction; source owns provider/configuration/cancellation failures. |

`ControlsTapTool` and `ControlsGetStatusTool` are retained compatibility classes, not registered
Copilot tools. Tap uses the same control-outcome checks; status is a local catalogue read.
If reintroduced, register them through the common boundary and permission catalogue.

## Verification

`tests/tool-error-audit.test.ts` exercises every registered tool's schema correction and
unexpected-handler sanitization, category preservation, cancellation, control preconditions,
corrected execution and the Realtime bridge. `tests/phoenix-mcp.test.ts` verifies actual
MCP feedback, a corrected follow-up, and safe disk-backed text conversation persistence.
Provider and application-specific tests verify the corresponding domain corrections.

PHOENIX server and Copilot pin the published npm package `@jdu/llm-client` to version `0.1.3`,
which includes structured tool-usage corrections and preserved MCP error feedback. The lockfile
records the registry artifact and its integrity; no patched local LLM archive is required.
Tool-error corrections do not authorize retries or game input.
