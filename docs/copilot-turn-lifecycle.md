# Copilot text turn lifetime

JSON and SSE callers own the same application turn. Closing the response before it
finishes cancels remaining model generation and tool dispatch. A normal completed
response is not cancellation. HTTP owns the response listener and removes it when
the request settles; `CopilotTurnLifecycle` owns the shared semantic events.
Server shutdown explicitly cancels and drains active text turns before ending
event streams or closing persistence. New chat requests during shutdown are rejected.

Cancellation does not undo a completed action. Its saved successful tool result
remains successful even when the final answer is lost. An interrupted action whose
outcome is unresolved remains unknown and non-retryable. Neither response mode
replays actions to repair a conversation.

Both modes publish start, transcript/tool progress and one terminal event. Closing
the application stream early publishes cancellation and closes the underlying
iterator. An ordinary provider failure publishes failure. Realtime voice keeps its
existing session lifecycle.

## Evidence and boundary

The pre-change HTTP characterization found that JSON continued into a tool effect
after client disconnect, whereas SSE cancelled it before dispatch. JSON also omitted
conversation lifecycle events. The maintained paired regressions now cover both
modes before dispatch, during an unresolved effect, after a completed effect and on
normal completion. They exercise real local HTTP, the AI SDK adapter/tool loop and
a reopened disk conversation store with a synthetic model and effect. Unit checks
cover iterator return, terminal events, active-state cleanup and listener disposal.
These checks do not claim live-provider, game or tablet acceptance.
