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
  const analyse = vi.fn(async () => ({ content: analysisContent, continuity: null, usage: analysisUsage }))
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
    expect((await fetch(`${origin}/api/galnet/investigation-leads`)).status).toBe(401)
    for (const [path, method, body] of [
      ['/api/galnet/background', 'GET', undefined],
      ['/api/galnet/coverage?articleId=synthetic-analysis', 'GET', undefined],
      ['/api/settings/galnet-background', 'PUT', { enabled: true, dailyLimit: 10 }],
      ['/api/galnet/catch-up', 'POST', { articleIds: [analysisArticle.id] }]
    ] as const) {
      expect((await fetch(`${origin}${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })).status).toBe(401)
    }
    const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST', body: JSON.stringify({ code: access.pairingCode }) })
    const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
    const request: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } })
    const client = new PhoenixApiClient(origin, request)
    await client.getGalnetNews()
    expect((await client.getGalnetAnalysis(analysisArticle.id)).analysis).toBeNull()
    expect(analyse).not.toHaveBeenCalled()
    expect(await client.getGalnetBackground()).toMatchObject({ enabled: false, pending: 0, requestsToday: 0,
      backlog: [{ articleId: analysisArticle.id }] })
    expect(await client.getGalnetCoverage(analysisArticle.id)).toEqual({ subjects: [], reports: [] })
    expect((await request(`${origin}/api/settings/galnet-background`, { method: 'PUT',
      body: JSON.stringify({ enabled: true, dailyLimit: 500 }) })).status).toBe(400)
    expect((await request(`${origin}/api/galnet/catch-up`, { method: 'POST',
      body: JSON.stringify({ articleIds: Array.from({ length: 21 }, () => analysisArticle.id) }) })).status).toBe(400)
    expect((await request(`${origin}/api/galnet/catch-up`, { method: 'POST',
      body: JSON.stringify({ articleIds: ['not-archived'] }) })).status).toBe(400)
    const invalid = await request(`${origin}/api/galnet/analysis`, { method: 'POST',
      body: JSON.stringify({ articleId: analysisArticle.id, model: 'unapproved' }) })
    expect(invalid.status).toBe(400)
    expect(analyse).not.toHaveBeenCalled()
    const invalidContent = structuredClone(analysisContent)
    invalidContent.facts[0]!.evidence = 'Invented "beacon" quote'
    analyse.mockResolvedValueOnce({ content: invalidContent, continuity: null, usage: analysisUsage })
    const rejected = await request(`${origin}/api/galnet/analysis`, { method: 'POST', body: JSON.stringify({ articleId: analysisArticle.id }) })
    expect(rejected.status).toBe(502)
    expect(await rejected.json()).toMatchObject({ error: { code: 'galnet_analysis_invalid_evidence',
      message: expect.stringContaining('facts[0].evidence: "Invented \\"beacon\\" quote"') } })
    expect(analyse).toHaveBeenCalledTimes(1)
    expect((await client.getGalnetAnalysis(analysisArticle.id)).analysis).toBeNull()
    const result = await client.analyseGalnetArticle(analysisArticle.id)
    expect(await client.getGalnetCoverage(analysisArticle.id)).toMatchObject({ reports: [{
      analysis: { schemaVersion: 3, cacheKey: result.analysis!.cacheKey }, contextChanged: false
    }] })
    expect(result.analysis?.content).toEqual(analysisContent)
    expect(result.analysis?.communityGoals.goals).toEqual(analysisGoals.goals)
    expect(await client.getGalnetInvestigationLeads()).toMatchObject({ reportLimit: 20,
      leads: [{ title: 'Investigate the beacon', systemName: 'Colonia', status: 'unknown', sourceUrl: analysisArticle.sourceUrl }] })
    await client.analyseGalnetArticle(analysisArticle.id)
    expect(analyse).toHaveBeenCalledTimes(2)
    expect(await client.saveGalnetBackground({ enabled: false, dailyLimit: 5 })).toMatchObject({ enabled: false, dailyLimit: 5 })
    expect(await client.catchUpGalnet([analysisArticle.id])).toMatchObject({ pending: 0 })
    await app.stop()
    const retained = new SqliteDatabase(path)
    try {
      retained.initialize()
      retained.initialize()
      expect(retained.galnetAnalyses.latest(analysisArticle.id)).toEqual(result.analysis)
      expect(retained.galnetBackground.load()).toMatchObject({ enabled: false, dailyLimit: 5 })
    } finally { retained.close() }
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})
