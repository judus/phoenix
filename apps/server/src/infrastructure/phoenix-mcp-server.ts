import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ToolRegistry,
  type JsonObject,
  type JsonValue,
  type ToolDefinition,
  type ToolExecutionOutput
} from '@judus/llm-client'

const PROTOCOL_VERSION = '2025-11-25'

interface JsonRpcRequest {
  id?: JsonValue
  jsonrpc?: string
  method: string
  params?: JsonObject
}

export class PhoenixMcpServer {
  private readonly sessions = new Set<string>()

  public constructor (private readonly tools: ToolRegistry) {}

  public async handle (request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === 'DELETE') {
      const sessionId = header(request, 'mcp-session-id')
      if (sessionId) this.sessions.delete(sessionId)
      response.writeHead(200)
      response.end()
      return
    }
    if (request.method !== 'POST') {
      writeError(response, null, -32600, 'MCP only accepts POST and DELETE requests.')
      return
    }

    let message: JsonRpcRequest
    try {
      message = parseRequest(await readJson(request))
    } catch (cause) {
      writeError(
        response,
        null,
        -32700,
        cause instanceof Error ? cause.message : 'Invalid JSON-RPC request.'
      )
      return
    }
    if (message.method === 'initialize') {
      const sessionId = randomUUID()
      this.sessions.add(sessionId)
      writeResult(response, message.id ?? null, {
        capabilities: { tools: {} },
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: 'phoenix-local', version: '0.1.0' }
      }, { 'mcp-session-id': sessionId })
      return
    }
    if (message.method === 'notifications/initialized') {
      response.writeHead(202)
      response.end()
      return
    }
    if (!this.hasSession(request)) {
      writeError(response, message.id ?? null, -32000, 'MCP session is missing or expired.')
      return
    }
    if (message.method === 'tools/list') {
      writeResult(response, message.id ?? null, {
        tools: this.tools.definitions.map(mcpDefinition)
      })
      return
    }
    if (message.method === 'tools/call') {
      await this.callTool(message, request, response)
      return
    }
    writeError(response, message.id ?? null, -32601, `Unknown MCP method: ${message.method}`)
  }

  private hasSession (request: IncomingMessage): boolean {
    const sessionId = header(request, 'mcp-session-id')
    return sessionId !== undefined && this.sessions.has(sessionId)
  }

  private async callTool (
    message: JsonRpcRequest,
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const name = message.params?.name
    const arguments_ = message.params?.arguments ?? {}
    if (typeof name !== 'string' || !isObject(arguments_)) {
      writeError(response, message.id ?? null, -32602, 'Tool name and object arguments are required.')
      return
    }
    const controller = new AbortController()
    const abort = (): void => {
      if (!response.writableEnded) {
        controller.abort(new DOMException('MCP client disconnected.', 'AbortError'))
      }
    }
    response.once('close', abort)
    try {
      const result = await this.tools.execute(
        { arguments: arguments_ as JsonObject, id: randomUUID(), name },
        {
          callId: randomUUID(),
          deadline: new Date(Date.now() + 30_000).toISOString(),
          runId: randomUUID(),
          signal: controller.signal
        }
      )
      writeResult(response, message.id ?? null, mcpToolResult(result))
    } catch (cause) {
      writeResult(response, message.id ?? null, {
        content: [{ text: cause instanceof Error ? cause.message : 'PHOENIX tool execution failed.', type: 'text' }],
        isError: true
      })
    } finally {
      response.off('close', abort)
    }
  }
}

function mcpDefinition (definition: ToolDefinition): JsonObject {
  const annotations = definition.annotations
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    ...(definition.outputSchema === undefined ? {} : { outputSchema: definition.outputSchema }),
    ...(annotations === undefined ? {} : {
      annotations: {
        ...(annotations.destructive === undefined ? {} : { destructiveHint: annotations.destructive }),
        ...(annotations.idempotent === undefined ? {} : { idempotentHint: annotations.idempotent }),
        ...(annotations.openWorld === undefined ? {} : { openWorldHint: annotations.openWorld }),
        ...(annotations.readOnly === undefined ? {} : { readOnlyHint: annotations.readOnly })
      }
    })
  }
}

function mcpToolResult (result: ToolExecutionOutput): JsonObject {
  const content = (result.content ?? []).flatMap(part => {
    if (part.type === 'text') return [{ text: part.text, type: 'text' }]
    return []
  })
  return {
    content,
    ...(result.structuredContent === undefined ? {} : { structuredContent: result.structuredContent })
  }
}

function parseRequest (candidate: unknown): JsonRpcRequest {
  if (!isObject(candidate) || typeof candidate.method !== 'string') {
    throw new Error('Invalid JSON-RPC request.')
  }
  return candidate as unknown as JsonRpcRequest
}

async function readJson (request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 1024 * 1024) throw new Error('MCP request body exceeds 1 MiB.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function header (request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return typeof value === 'string' ? value : undefined
}

function isObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function writeResult (
  response: ServerResponse,
  id: JsonValue,
  result: JsonObject,
  headers: Record<string, string> = {}
): void {
  writeJson(response, { id, jsonrpc: '2.0', result }, headers)
}

function writeError (
  response: ServerResponse,
  id: JsonValue,
  code: number,
  message: string
): void {
  writeJson(response, { error: { code, message }, id, jsonrpc: '2.0' })
}

function writeJson (
  response: ServerResponse,
  payload: JsonObject,
  headers: Record<string, string> = {}
): void {
  const body = JSON.stringify(payload)
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    ...headers
  })
  response.end(body)
}
