import { expect, test, vi } from 'vitest'
import type { ModelProvider, ModelResponse } from '@jdu/llm-client'
import { defaultOpenAIModelCapabilities } from '@jdu/llm-client/providers/openai'
import { OpenAiGalnetArticleAnalyser } from '../apps/server/src/infrastructure/openai-galnet-article-analyser.js'
import { analysisArticle, analysisContent, analysisGoals, analysisUsage } from './support/galnet-analysis-fixtures.js'

const article = { schemaVersion: 1 as const, revisionId: 'revision-1', article: analysisArticle,
  firstObservedAt: '2026-10-07T12:00:00Z', lastObservedAt: '2026-10-07T12:00:00Z' }
function setup() {
  const response: ModelResponse = { id: 'response', finishReason: 'stop', model: { provider: 'openai', model: 'synthetic' },
    usage: analysisUsage, message: { id: 'response', conversationId: 'test', createdAt: '2026-10-07T12:00:00Z',
      role: 'assistant', content: [{ type: 'text', text: JSON.stringify(analysisContent) }] } }
  const provider: ModelProvider = { id: 'openai', capabilities: async () => defaultOpenAIModelCapabilities(),
    generate: vi.fn(async () => response), stream: async function* () {} }
  return { response, provider, analyser: new OpenAiGalnetArticleAnalyser(() => undefined, 'synthetic', provider) }
}

test('existing low-level client requests bounded strict structured output without tools, history or private game state', async () => {
  const { analyser, provider } = setup()
  const signal = new AbortController().signal
  expect(await analyser.analyse(article, analysisGoals, signal)).toEqual({ content: analysisContent, usage: analysisUsage })
  expect(provider.generate).toHaveBeenCalledWith(expect.objectContaining({
    model: { provider: 'openai', model: 'synthetic' }, limits: { maxOutputTokens: 4000 },
    responseFormat: expect.objectContaining({ type: 'json_schema', strict: true })
  }), expect.objectContaining({ signal, timeoutMs: 90_000 }))
  const request = vi.mocked(provider.generate).mock.calls[0]![0]
  expect(request.tools).toBeUndefined()
  expect(request.hostedTools).toBeUndefined()
  const messages = JSON.stringify(request.messages)
  expect(messages).toContain('untrusted data')
  expect(messages).toContain('Never repeat that campaign')
  expect(messages).toContain('destination null unless the article explicitly identifies its actionable destination system')
  expect(messages).toContain('must not invent coordinates')
  expect(messages).toContain('cg-research')
})

test.each(['truncated', 'refused', 'malformed'] as const)('rejects %s output without returning a report', async fault => {
  const { analyser, provider, response } = setup()
  vi.mocked(provider.generate).mockResolvedValue(fault === 'truncated' ? { ...response, finishReason: 'length' }
    : { ...response, message: { ...response.message, content: fault === 'refused'
      ? [{ type: 'refusal', reason: 'No' }] : [{ type: 'text', text: '{' }] } })
  await expect(analyser.analyse(article, analysisGoals, new AbortController().signal)).rejects.toMatchObject({
    code: fault === 'malformed' ? 'galnet_analysis_invalid_output' : 'galnet_analysis_incomplete'
  })
})
