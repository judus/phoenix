import { expect, test, vi } from 'vitest'
import { ToolRegistry } from '@jdu/llm-client'
import { WebSearchTool } from '../apps/server/src/application/mcp-tools/web-search-tool.js'
import { OpenAiWebSearchSource } from '../apps/server/src/infrastructure/openai-web-search-source.js'
import type { WebSearchSource } from '../apps/server/src/domain/web-search.js'

test('the web search tool returns a bounded sourced result through the shared tool registry', async () => {
  const source: WebSearchSource = {
    async search () {
      return {
        answer: 'The answer is current.',
        sources: Array.from({ length: 10 }, (_, index) => ({
          title: `Source ${index + 1}`,
          url: `https://example.com/${index + 1}`
        }))
      }
    }
  }
  const tools = new ToolRegistry([new WebSearchTool(source)])

  const result = await tools.execute(
    { arguments: { query: 'current answer' }, id: 'call-1', name: 'web.search' },
    {
      callId: 'call-1',
      deadline: new Date(Date.now() + 1_000).toISOString(),
      runId: 'run-1',
      signal: new AbortController().signal
    }
  )

  expect(result.structuredContent).toMatchObject({
    answer: 'The answer is current.',
    query: 'current answer',
    sources: expect.arrayContaining([{ title: 'Source 1', url: 'https://example.com/1' }])
  })
  expect((result.structuredContent as { sources: unknown[] }).sources).toHaveLength(8)
})

test('the OpenAI web search adapter requests hosted search and extracts unique citations', async () => {
  const request = vi.fn<typeof fetch>(async (_input, init) => {
    expect(init?.headers).toMatchObject({ authorization: 'Bearer secret-key' })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      include: ['web_search_call.action.sources'],
      input: 'latest Elite Dangerous update',
      model: 'search-model',
      tool_choice: 'required',
      tools: [{ search_context_size: 'low', type: 'web_search' }]
    })
    return new Response(JSON.stringify({
      output: [
        {
          action: {
            sources: [
              { title: 'Frontier', type: 'url', url: 'https://www.elitedangerous.com/news' },
              { title: 'Ignored', type: 'url', url: 'javascript:alert(1)' }
            ],
            type: 'search'
          },
          type: 'web_search_call'
        },
        {
          content: [{
            annotations: [{ title: 'Frontier duplicate', type: 'url_citation', url: 'https://www.elitedangerous.com/news' }],
            text: 'Frontier published an update.',
            type: 'output_text'
          }],
          type: 'message'
        }
      ]
    }), { headers: { 'content-type': 'application/json' }, status: 200 })
  })
  const source = new OpenAiWebSearchSource({
    apiKey: () => 'secret-key',
    fetch: request,
    model: 'search-model'
  })

  await expect(source.search('latest Elite Dangerous update', new AbortController().signal)).resolves.toEqual({
    answer: 'Frontier published an update.',
    sources: [{ title: 'Frontier', url: 'https://www.elitedangerous.com/news' }]
  })
  expect(request).toHaveBeenCalledOnce()
})

test('the OpenAI web search adapter reports rate limiting without exposing response bodies', async () => {
  const source = new OpenAiWebSearchSource({
    apiKey: () => 'secret-key',
    fetch: async () => new Response('private provider detail', {
      headers: { 'retry-after': '30' },
      status: 429
    }),
    model: 'search-model'
  })

  await expect(source.search('query', new AbortController().signal))
    .rejects.toThrow('OpenAI web search is rate limited. Retry after 30.')
})
