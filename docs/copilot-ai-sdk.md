# Copilot AI SDK integration

AI SDK handles model protocol/stream decoding. PHOENIX retains the conversation store,
profile instructions, tool registry, runtime validation, permissions and local execution.
All enabled tool definitions are supplied upfront. Discovery and hosted MCP tunnels are not used.
Cloud requests are outbound; providers do not connect to the local MCP endpoint.

## Provider settings

Settings > Copilot selects OpenAI, Anthropic (Claude) or Google (Gemini) for text.
Save the provider's API key and exact tool-capable model ID, then restart PHOENIX.
OpenAI can leave the model blank to retain PHOENIX_OPENAI_MODEL or the server default.
Other providers require an explicit model ID. Model IDs are not a claim that every model
supports PHOENIX tools or performs equally well.

Keys are stored in private files on the PHOENIX computer. Settings responses contain status
only. Environment alternatives are PHOENIX_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY and
PHOENIX_GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY; stored keys take precedence.
Changing text provider does not change the OpenAI key used for realtime voice, GalNet analysis
and web search. No fallback sends a request to another provider without the user's selection.

OpenAI, Anthropic and Google adapters are exercised with intercepted in-process native API
responses. These tests establish payload routing and decoding, not live model acceptance.

The text adapter persists each assistant step and each tool result before continuing.
Conversation schema 1 remains unchanged, including the reader for user-owned histories with
MCP-qualified tool names. New assistant records also retain validated SDK messages in metadata,
including provider reasoning state. This metadata is not displayed as conversation text.

Model requests use zero automatic retries. An interrupted effect has an explicitly unknown
outcome; pending calls are saved as not executed. Neither is automatically replayed. The current
request and its tool results are never silently dropped to fit the context limit. A conservative
serialized-byte budget with a framing/output reserve bounds each model request; it is not a tokenizer.

## Continuing long conversations

Text Copilot retains the full saved transcript while using a rolling summary and recent whole
turns for model context. Existing `historySummary` checkpoints name the last covered archived
message; their append position does not hide newer uncovered messages. Old-client checkpoints
can end inside a turn after a settled tool exchange. Restore the complete overlapping turn in
that case rather than dropping its question, reasoning, tool results or final answer. Broken
boundaries and checkpoints splitting unsettled tool calls fail explicitly.

When context reaches 80% of the configured budget, older completed turns are summarized in
bounded prefix batches toward a 60% context target. Every batch combines the last valid summary
with newly covered historical data. The selected text model receives a separate tool-free request
with zero retries, the turn's timeout/cancellation signal, up to 4096 output tokens and a bounded
summary size. Summary usage is included in successful turn usage. This can consume provider credit,
as with the original client's automatic conversation compression.

Append a checkpoint only after a complete, nonempty, bounded response and revision-checked save.
Source messages remain stored. A later batch failure leaves earlier valid checkpoints usable and
the uncovered suffix intact. Cancellation/provider/store failure cannot authorize tool execution or
continue with an unsaved summary. Summaries are quoted historical data, not system instructions or
permission to repeat completed/unknown effects. Current instructions and permissions remain authoritative.
Retained recent SDK messages keep their opaque provider reasoning alongside tool calls/results.

A single historical turn too large for one summary request, or current instructions/request/tool
results too large even without older turns, produces a specific error without silently clipping
content or suggesting a nonexistent new-conversation action. Native realtime voice remains unchanged.

Existing realtime voice remains a separate, working backend. Switching text to AI SDK does not
replace microphone capture, voice-host ownership or audio sessions. SDK realtime acceptance is a
separate integration checkpoint; there is no automatic fallback that repeats a failed action.

The default voice-token backend remains `native`. Set `PHOENIX_REALTIME_BACKEND=ai-sdk` before
starting the server to test SDK token creation with the same PHOENIX browser voice/session path.
Set it back to `native` and restart to use the existing implementation. Selection is explicit;
there is no automatic retry on another backend. The SDK's supported provider overrides preserve
the complete native session, including `create_response: false`, semantic VAD, tool definitions,
voice and transcription settings. Fixture tests compare the native and SDK request bodies exactly.
This is token/session-configuration parity, not a live audio or SDK browser-hook migration claim.

Tests use synthetic model streams and local executors, not paid inference or real Elite commands.
Live model quality, actual microphone/audio behavior and physical Android acceptance are separate.
