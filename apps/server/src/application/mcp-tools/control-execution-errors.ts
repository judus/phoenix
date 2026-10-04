import { AiError, ToolUsageError } from '@jdu/llm-client'
import type { GameActionResult } from '@phoenix/contracts'

/** A failed operation may have produced input already; never recommend blind retries. */
export function assertControlExecution (toolName: string, result: Pick<GameActionResult, 'status' | 'message'>): void {
  switch (result.status) {
  case 'accepted':
  case 'already_satisfied':
  case 'confirmed':
  case 'unconfirmed':
    return
  case 'rejected':
    if (result.message === 'This Copilot capability is disabled in Settings.') {
      throw new AiError('authorization', `Tool ${toolName}: this control is disabled for Copilot. Ask the user to enable its capability in Settings; do not retry or substitute another control.`, {
        code: 'copilot_capability_disabled', retryable: false
      })
    }
    if (result.message === 'Unknown command target.') {
      throw new ToolUsageError(toolName, 'The command target is unknown.', 'Use controls.find_actions and copy its exact target. Only execute after the user explicitly requests the operation.')
    }
    throw new AiError('tool_execution', `Tool ${toolName}: control execution was rejected. Ask the user to check the control configuration and availability; do not retry or substitute another action.`, {
      code: 'control_execution_rejected', retryable: false
    })
  case 'failed':
  case 'timed_out':
  case 'cancelled': {
    const category = result.status === 'timed_out' ? 'timeout' : result.status === 'cancelled' ? 'cancelled' : 'tool_execution'
    throw new AiError(category, `Tool ${toolName}: control execution ${result.status}. Input may already have been sent. Report the outcome and do not repeat the operation without a new user request.`, {
      code: `control_execution_${result.status}`, retryable: false
    })
  }
  default: {
    // A new contract status must be classified explicitly, never reported as success.
    const unexpected: never = result.status
    throw new AiError('tool_execution', `Tool ${toolName}: an unrecognized control outcome was returned. Input may already have been sent. Report the failure and do not repeat the operation without a new user request.`, {
      code: 'control_execution_unknown', retryable: false, cause: unexpected
    })
  }
  }
}
