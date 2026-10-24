/** Application-facing text contract. Provider SDK details stay in server adapters. */
export interface CopilotRunOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export interface CopilotUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cachedInputTokens?: number
  readonly reasoningTokens?: number
}

export interface CopilotResult {
  readonly chatId: string
  readonly text: string
  readonly finishReason: 'cancelled' | 'content_filter' | 'error' | 'length' | 'stop' | 'tool_calls' | 'unknown'
  readonly usage: CopilotUsage
}

export type CopilotStreamEvent =
  | { readonly type: 'run.started', readonly chatId: string }
  | { readonly type: 'run.retrying', readonly attempt: number }
  | { readonly type: 'text.reset' }
  | { readonly type: 'text.delta', readonly delta: string }
  | { readonly type: 'tool.call', readonly call: { readonly id: string, readonly name: string } }
  | { readonly type: 'tool.result', readonly callId: string, readonly status: 'cancelled' | 'error' | 'success' }
  | { readonly type: 'run.completed', readonly result: CopilotResult }
