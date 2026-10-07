import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { analysisArticle, analysisContent, analysisGoals, analysisUsage } from './support/galnet-analysis-fixtures.js'

test('paired manual HTTP analysis preserves goal references and survives restart without background spending', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-analysis-http-'))
  const path = join(directory, 'state.sqlite')
  const access = new PairingAccessController(join(directory, 'pairing.json'))
  const analyse = vi.fn(async () => ({ content: analysisContent, usage: analysisUsage }))
  const app = new PhoenixApplication({ databasePath: path, eliteDirectory: null, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null, accessControl: access,
    galnetSource: { getLatest: async () => [analysisArticle] },
    communityGoalsSource: { getCurrent: async () => analysisGoals.goals },
    galnetAnalyser: { model: 'synthetic-model', configured: () => true, analyse } })
  try {
    const address = await app.start()
    const origin = `http://${address.host}:${address.port}`
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${origin}/api/galnet/analysis?articleId=${analysisArticle.id}`, { method,
        ...(method === 'POST' ? { body: JSON.stringify({ articleId: analysisArticle.id }) } : {}) })
      expect(response.status).toBe(401)
    }
    expect(analyse).not.toHaveBeenCalled()
    const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST', body: JSON.stringify({ code: access.pairingCode }) })
    const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
    const request: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } })
    const client = new PhoenixApiClient(origin, request)
    await client.getGalnetNews()
    expect((await client.getGalnetAnalysis(analysisArticle.id)).analysis).toBeNull()
    expect(analyse).not.toHaveBeenCalled()
    const invalid = await request(`${origin}/api/galnet/analysis`, { method: 'POST',
      body: JSON.stringify({ articleId: analysisArticle.id, model: 'unapproved' }) })
    expect(invalid.status).toBe(400)
    expect(analyse).not.toHaveBeenCalled()
    const result = await client.analyseGalnetArticle(analysisArticle.id)
    expect(result.analysis?.content).toEqual(analysisContent)
    expect(result.analysis?.communityGoals.goals).toEqual(analysisGoals.goals)
    await client.analyseGalnetArticle(analysisArticle.id)
    expect(analyse).toHaveBeenCalledTimes(1)
    await app.stop()
    const retained = new SqliteDatabase(path)
    try {
      retained.initialize()
      retained.initialize()
      expect(retained.galnetAnalyses.latest(analysisArticle.id)).toEqual(result.analysis)
    } finally { retained.close() }
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})
