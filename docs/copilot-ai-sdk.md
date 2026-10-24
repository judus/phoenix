# Copilot AI SDK integration

AI SDK handles model protocol/stream decoding. PHOENIX retains the conversation store,
profile instructions, tool registry, runtime validation, permissions and local execution.
All enabled tool definitions are supplied upfront. Discovery and hosted MCP tunnels are not used.
Cloud requests are outbound; providers do not connect to the local MCP endpoint.

The text adapter persists each assistant step and each tool result before continuing.
Conversation schema 1 remains unchanged, including the reader for user-owned histories with
MCP-qualified tool names. New assistant records also retain validated SDK messages in metadata,
including provider reasoning state. This metadata is not displayed as conversation text.

Model requests use zero automatic retries. An interrupted effect has an explicitly unknown
outcome; pending calls are saved as not executed. Neither is automatically replayed. The current
request and its tool results are never silently dropped to fit the context limit. A conservative
serialized-byte estimate with a framing/output reserve rejects oversized context before the next
model request. This is intentionally not a tokenizer or history-compression implementation.

Existing realtime voice remains a separate, working backend. Switching text to AI SDK does not
replace microphone capture, voice-host ownership or audio sessions. SDK realtime acceptance is a
separate integration checkpoint; there is no automatic fallback that repeats a failed action.

Tests use synthetic model streams and local executors, not paid inference or real Elite commands.
Live model quality, actual microphone/audio behavior and physical Android acceptance are separate.
