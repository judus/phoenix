import { AiError, ToolUsageError, type LocalTool } from '@jdu/llm-client'
import { ToolArgumentError } from './tool-support.js'
import { ProviderQueryError } from '../../domain/provider-query-error.js'

/** One public error contract for the local, MCP and realtime execution paths. */
export function withToolErrorBoundary (tool: LocalTool): LocalTool {
  return {
    definition: tool.definition,
    execute: async (arguments_, context) => {
      try {
        return await tool.execute(arguments_, context)
      } catch (cause) {
        if (cause instanceof AiError) throw cause
        if (context.signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) {
          throw new AiError('cancelled', `Tool ${tool.definition.name} was cancelled. Do not retry without a new user request.`, {
            code: 'tool_cancelled', retryable: false, cause
          })
        }
        if (cause instanceof ToolArgumentError) {
          throw new ToolUsageError(tool.definition.name, cause.message, cause.correction)
        }
        if (cause instanceof ProviderQueryError) {
          if (cause.kind === 'reference_system_not_found') {
            throw new ToolUsageError(tool.definition.name, cause.message,
              'The provider does not know the reference system. Ask the user to choose a known reference system; do not change the search filters or repeat the unchanged call.')
          }
          if (cause.kind === 'not_found') {
            throw new ToolUsageError(tool.definition.name, cause.message,
              'Verify the requested record using the available lookup tools or ask the user for its exact name. The provider may lack this record; do not repeat the unchanged call.')
          }
          const transient = ['transport', 'timeout', 'rate_limit', 'provider_unavailable'].includes(cause.kind)
          const correction = transient
            ? 'The provider is unavailable or limiting requests. Try again later; do not guess different query arguments.'
            : cause.kind === 'request_rejected'
              ? 'Report the provider request rejection; its query format or configuration needs investigation. Do not guess different arguments or retry unchanged.'
              : cause.kind === 'malformed_response'
                ? 'Report the unreadable provider response; do not change arguments or repeat the call automatically.'
                : 'Ask the user to check provider access/configuration; do not change query arguments or retry unchanged.'
          throw new AiError(cause.kind === 'request_rejected' ? 'invalid_request' : cause.kind, `${cause.message} ${correction}`, {
            code: `provider_${cause.kind}`, retryable: transient, cause
          })
        }
        throw new AiError('tool_execution', `Tool ${tool.definition.name} failed internally. Report the failure to the user; do not guess different arguments or repeat the operation.`, {
          code: 'tool_internal_error', retryable: false, cause
        })
      }
    }
  }
}
