# `@phoenix/control-deck`

Control Deck is the host-neutral command-surface package used by Phoenix. It is intentionally one package with three entry points:

- `@phoenix/control-deck`: serializable command, layout, macro, and numpad contracts plus macro playback;
- `@phoenix/control-deck/host`: pairing sessions, QR-ready one-time challenges, LAN address discovery, and the restricted satellite HTTP gateway;
- `@phoenix/control-deck/react`: reusable numpad session and grid presentation.

The package is private while its API settles inside Phoenix. It has no Elite, Phoenix API, MCP, Copilot, or OS-input knowledge.

## Host contract

A host supplies stable command descriptors and an executor. Layout cells, macro steps, and numpad shortcuts retain only `commandId`; the host owns what that ID means and whether execution is authorized.

```ts
import type { CommandExecutor, CommandCataloguePort } from '@phoenix/control-deck'

const catalogue: CommandCataloguePort = applicationCatalogue
const executor: CommandExecutor = applicationExecutor
```

Command `kind` and effects are open strings. Generic runtime code uses declared capabilities such as `supportedOperations` and `recordable`; it does not switch on application-specific kinds.

## Persistence versions

- control-grid layout: version 5 (`groupId`, `commandId`);
- macro library and definitions: version 2 (`command` steps with `commandId`);
- Phoenix settings: version 2.

Phoenix repository adapters migrate older target/action-based documents in memory, validate the full result, and then replace the source atomically. Command IDs existing before extraction are unchanged.

## Satellite gateway

`ControlDeckSatelliteServer` is a second listener in the same host process. It exposes only:

- pairing status, claim, release, session listing, and session revocation;
- command catalogue and execution;
- the current grid layout;
- numpad snapshot and execution.

Unknown endpoints—including Phoenix runtime data, MCP, Copilot, and settings—return `404`. All Control Deck operations require a paired browser session or installation bearer token. Manual codes and short-lived one-time challenges use the same pairing controller.

Phoenix keeps this listener disabled unless `PHOENIX_CONTROL_DECK_ENABLED=true`. Its host and port default to `0.0.0.0:3402` when enabled and can be changed with `PHOENIX_CONTROL_DECK_HOST` and `PHOENIX_CONTROL_DECK_PORT`. The complete Phoenix API remains bound to loopback.

The current extraction provides the reusable API gateway and React primitives. A standalone Control Deck composition and its generic command/profile editor remain separate product work; Phoenix deliberately exposes only Elite actions, Phoenix navigation, and Phoenix macros.
