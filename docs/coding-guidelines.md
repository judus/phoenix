# PHOENIX Coding Guidelines

PHOENIX maintains the commander's operational world. Browser views, Copilot tools, controls, and future modules must consume the same state and application services rather than build parallel feature-specific models.

## Dependency rules

- Browser code never interprets raw Elite files.
- Ingestion preserves raw identifiers and timestamps, then emits validated contracts or normalized events.
- UI components consume application APIs and shared contracts; they do not own game rules.
- MCP tools delegate to application services and contain no independent business logic.
- External services remain behind source or gateway adapters.
- Infrastructure types do not leak into shared domain contracts.
- Character identity and personality remain profile content, not application logic.
- Authorization, action safety, and capability configuration belong to PHOENIX, not the reusable LLM client.

## State and events

Keep these forms of information distinct:

- authoritative live telemetry;
- derived current runtime state;
- durable historical observations;
- externally cached knowledge with freshness and provenance;
- user configuration and secrets;
- Copilot conversations and character state.

Do not turn `RuntimeState` into a universal storage object. New data belongs there only when it describes the commander's current operational state.

Internal processes subscribe to typed events. Logs are evidence for humans, not an automation queue. Preserve ordering, timestamps, provenance, deduplication, and replay safety.

## Actions

Every game-affecting operation crosses `GameActionGateway`, whether initiated by UI, Copilot, macro, or future automation.

Actions should have stable namespaced identifiers and increasingly support:

- availability and capability metadata;
- cancellation and timeout;
- correlation and audit identifiers;
- idempotency where meaningful;
- explicit accepted, failed, and telemetry-confirmed outcomes.

Never equate a successfully emitted input with a confirmed in-game state change.

## Structure

Prefer concrete classes implementing narrow contracts when a boundary has multiple implementations, lifecycle, or external effects. Prefer plain functions for stable internal calculations. Avoid interfaces, factories, and folders that exist only for architectural appearance.

`PhoenixApplication` is the composition root. Its size alone is not a defect. Extract feature assembly when a subsystem gains its own configuration, optional availability, lifecycle, or several collaborating adapters. Likely future seams are telemetry, controls, Copilot, persistence, and packaging.

## Growth watchlist

Review the architecture when any of these begin to occur:

- `PhoenixApplication` contains feature decisions rather than assembly.
- Text and Realtime paths drift in prompts, tools, history, or behavior.
- MCP tools duplicate service logic.
- Multiple browser streams or screens compete for state or commands.
- Runtime state accumulates historical, cached, or configuration data.
- Macros bypass action observability or cancellation.
- Profiles acquire implicit, undocumented tool permissions.
- Resource paths assume a writable repository or installation directory.

When a trigger appears, split at the demonstrated seam. Do not pre-emptively introduce microservices, a dependency-injection framework, a generic plugin platform, workflow engine, macro language, or multi-agent framework.

## Change discipline

- Add or update contracts before crossing a new process or persistence boundary.
- Characterize migrated ICARUS behavior with tests before refactoring it.
- Test ordering, retries, reconnection, replay, and stale-data behavior—not only happy paths.
- Keep copied code and assets attributable and license-compatible.
- Keep secrets, commander data, runtime state, conversations, caches, and detailed wire logs out of Git.
- Update `.context/` when a change materially alters architecture, delivery plans, or current capability.
