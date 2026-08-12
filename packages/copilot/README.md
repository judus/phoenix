# PHOENIX Copilot

This package owns the portable Copilot application layer: agent profiles, prompt composition,
Elite runtime-context rendering, mode selection, and conversation orchestration.

It deliberately reuses `@judus/llm-client` for provider-neutral model calls, streaming, MCP tool loops,
tool-call-safe history selection, usage reporting, and conversation-store contracts. OpenAI transport
details do not belong here.

PHOENIX-specific HTTP routes, JSON persistence, game queries/actions, Realtime transport, and browser
audio are adapters around this package rather than dependencies of its core logic.
