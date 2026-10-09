// npm run build, then: node --import tsx scripts/diagnostics/isolated-browser-preview.mjs
// In-memory browser diagnostics only: no real journals, game input, or provider requests.
// Add --prospecting for a synthetic pre-Odyssey candidate with unknown signal counts.
// Add --copilot-navigation for delayed synthetic chat using real MCP and history persistence.
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { PhoenixApplication } from '../../apps/server/src/phoenix-application.ts'
import { MissionDataService } from '../../apps/server/src/application/mission-data-service.ts'
import { SqliteDatabase } from '../../apps/server/src/infrastructure/sqlite-database.ts'
import { parseMicroResourceInventory } from '@phoenix/elite'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { mockDenseCartography } from './mock-dense-cartography.mjs'
import { SqliteEddnOutbox } from '../../apps/server/src/infrastructure/sqlite-eddn-outbox.ts'
import { SqliteGalnetArticleArchive } from '../../apps/server/src/infrastructure/sqlite-galnet-article-archive.ts'
import { createNavigationCopilot } from './copilot-navigation-fixture.mjs'

const require = createRequire(import.meta.url)
const { RecordingKeyboardOutput } = require('control-deck/adapter-keyboard')
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const denseCartography = process.argv.includes('--dense-cartography')
const eddnSubmissions = process.argv.includes('--eddn-submissions')
const prospecting = process.argv.includes('--prospecting')
const atlasPois = process.argv.includes('--atlas-pois')
const communityGoals = process.argv.includes('--community-goals')
const missionBrief = process.argv.includes('--mission-brief')
const galnetArchive = process.argv.includes('--galnet-archive')
// Exercise display-tool navigation during a real HTTP chat stream, without paid inference.
const copilotNavigation = process.argv.includes('--copilot-navigation')
let copilotOrigin
const galnetContinuity = process.argv.includes('--galnet-continuity') || galnetArchive
const galnetAnalysis = process.argv.includes('--galnet-analysis') || galnetContinuity
const continuityArticles = [
  { id: 'synthetic-breakout', title: 'Synthetic ship breakout', body: 'Synthetic EVE-597 reported a breakout in Sol. Pilots can register at Galileo.', publishedAt: '2026-10-01T12:00:00Z' },
  { id: 'synthetic-found', title: 'Synthetic ship located', body: 'Synthetic EVE-597 has been found in Sol; the search has ended.', publishedAt: '2026-09-22T12:00:00Z' },
  { id: 'synthetic-missing', title: 'Synthetic ship missing', body: 'Synthetic EVE-597 is missing after departing Sol. Its current position is unknown.', publishedAt: '2026-09-17T12:00:00Z' }
].map(article => ({ ...article, changedAt: article.publishedAt, image: null, slug: article.id,
  sourceUrl: `https://example.com/galnet/${article.id}` }))
const fixtureDirectory = eddnSubmissions || galnetArchive || missionBrief ? mkdtempSync(join(tmpdir(), 'phoenix-isolated-preview-')) : undefined
const databasePath = fixtureDirectory ? join(fixtureDirectory, 'preview.sqlite') : ':memory:'
// This preview must never upload, even when launched from a test-enabled development shell.
process.env.PHOENIX_EDDN_TEST_MODE = '0'
// Fail closed if a diagnostic route accidentally reaches an external provider.
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error(`External network is disabled in the diagnostic fixture: ${url.origin}`)
  }
  return nativeFetch(input, options)
}
const application = new PhoenixApplication({
  databasePath,
  eliteDirectory: null,
  eliteBindingsDirectory: null,
  host: '127.0.0.1',
  port: 0,
  keyboardOutput: new RecordingKeyboardOutput(),
  webRoot: `${projectRoot}apps/web/dist`,
  copilot: copilotNavigation ? createNavigationCopilot(() => copilotOrigin) : null,
  copilotRealtime: null,
  openAiEnvironmentKey: null,
  ...(galnetAnalysis ? {
    galnetSource: { getLatest: async () => galnetContinuity ? continuityArticles : [{
      id: 'synthetic-analysis', title: 'Synthetic research campaign',
      body: 'Pilots should deliver supplies to Galileo in Sol. A separate beacon in Colonia needs investigation.',
      image: null, publishedAt: '2026-10-01T12:00:00Z', changedAt: '2026-10-01T12:00:00Z',
      slug: 'synthetic-research', sourceUrl: 'https://example.com/galnet/synthetic-analysis'
    }, { id: 'synthetic-narrative', title: 'Synthetic narrative only', body: 'A ceremonial speech was broadcast.',
      image: null, publishedAt: '2026-09-30T12:00:00Z', changedAt: '2026-09-30T12:00:00Z',
      slug: 'synthetic-narrative', sourceUrl: 'https://example.com/galnet/synthetic-narrative' }] },
    galnetAnalyser: { model: 'synthetic-no-network', configured: () => true, analyse: async (article, _goals, _signal, context) => {
      await new Promise(resolve => setTimeout(resolve, 200))
      const found = article.article.id === 'synthetic-found' ? article.article : context.find(entry => entry.source.articleId === 'synthetic-found')?.article
      const continuity = context.length === 0 ? null : {
        summary: article.article.id === 'synthetic-found' ? 'The missing ship was located. The earlier search has concluded.'
          : 'The ship disappeared, was located, and later coverage reports a separate combat appeal. The search ending does not conclude the combat campaign.',
        relatedArticleIds: context.map(entry => entry.source.articleId),
        developments: [...context].reverse().map(entry => ({ text: entry.article.title, evidence: { articleId: entry.article.id, quote: entry.article.body } }))
          .concat([{ text: article.article.title, evidence: { articleId: article.article.id, quote: article.article.body } }]),
        updates: found ? context.filter(entry => entry.source.articleId === 'synthetic-missing').flatMap(entry => entry.activities.map(activity => ({
          leadId: activity.leadId, disposition: 'resolved', explanation: 'The missing-ship search concluded when the ship was located.',
          evidence: { articleId: found.id, quote: found.body }, replacementActivityIndex: null, communityGoalId: null
        }))) : []
      }
      if (galnetContinuity) return { continuity, usage: { inputTokens: 1200, outputTokens: 400 }, content: {
        summary: article.article.body, facts: [{ text: article.article.title, evidence: article.article.body }], interpretations: [],
        entities: [{ name: 'EVE-597', kind: 'ship', role: 'Synthetic story subject', evidence: article.article.body }],
        activities: [{ title: article.article.id === 'synthetic-breakout' ? 'Combat appeal' : 'Find the ship',
          action: article.article.body, evidence: article.article.body,
          communityGoalId: article.article.id === 'synthetic-breakout' ? 'synthetic-0' : null,
          relationship: article.article.id === 'synthetic-breakout' ? 'explicit' : 'none',
          status: article.article.id === 'synthetic-found' ? 'ended' : 'unknown', destination: null }]
      } }
      return { continuity: null, usage: { inputTokens: 1200, outputTokens: 400 }, content: {
        summary: 'Synthetic public-news analysis; no AI request was made.',
        facts: [{ text: 'The source describes a fictional event.', evidence: article.article.body }],
        interpretations: [], entities: article.article.id === 'synthetic-analysis' ? [{ name: 'Colonia', kind: 'system',
          role: 'Investigation destination', evidence: 'beacon in Colonia needs investigation' }] : [], activities: article.article.id === 'synthetic-analysis' ? [{
          title: 'Supply campaign', action: 'See the linked Community Goal before contributing.',
          evidence: 'deliver supplies to Galileo in Sol', communityGoalId: 'synthetic-0', relationship: 'explicit', status: 'unknown', destination: null
        }, { title: 'Investigate the beacon', action: 'Investigate if interested; outcome unknown.',
          evidence: 'A separate beacon in Colonia needs investigation.', communityGoalId: null, relationship: 'none', status: 'unknown',
          destination: { systemName: 'Colonia', evidence: 'beacon in Colonia needs investigation' } }] : []
      } }
    } }
  } : {}),
  communityGoalsSource: { getCurrent: async () => communityGoals || galnetAnalysis ? Array.from({ length: 20 }, (_, index) => ({
    id: `synthetic-${index}`, title: `Synthetic campaign ${index + 1}`, systemName: index < 2 ? 'Sol' : `Synthetic CG ${Math.floor(index / 2)}`, stationName: 'Galileo',
    activityType: 'trade', objective: 'Deliver research supplies', targetCommodities: 'Basic Medicines',
    contributed: 125 + index, target: 1000, expiry: '2026-10-08 10:00:00',
    briefing: Array.from({ length: 15 }, (_, paragraph) => `Synthetic briefing ${index + 1}, paragraph ${paragraph + 1}. Sign up at the listed destination and contribute to this fictional research campaign.`).join('\n\n')
  })) : [] },
  atlasSources: atlasPois ? [{
    id: 'synthetic', name: 'Synthetic Atlas fixture', url: 'https://example.com/atlas', licence: null,
    getPois: async () => ({ rejected: 0, pois: Array.from({ length: 1500 }, (_, index) => ({
      id: `synthetic:${index}`, label: `Synthetic POI ${index}`, systemName: `Synthetic system ${index}`,
      position: [Math.sin(index) * 12000, index % 100, Math.cos(index) * 12000],
      categories: [index % 2 ? 'Guardian Ruins' : 'Guardian Structures'],
      source: 'Synthetic Atlas fixture', sourceUrl: 'https://example.com/atlas', bodyName: 'A 1', siteType: 'Turtle'
    })) })
  }] : [],
  ...(prospecting ? { explorationTargetSource: { findTargets: async () => [{
    atmosphere: 'Thin Ammonia', biologicalSignals: null, bodyId: 1, bodyName: 'Synthetic A 1', bodyType: 'Planet',
    distanceLy: 10, distanceToArrivalLs: 200, geologicalSignals: null, gravityG: 0.2, landable: false,
    providerUpdatedAt: '2021-05-18T12:00:00Z', signalsUpdatedAt: null, subtype: 'High metal content world',
    surfaceTemperatureK: 180, systemAddress: 42, systemName: 'Synthetic', volcanism: null
  }] } } : {}),
  cartographySource: { fetchSystem: async name => denseCartography ? mockDenseCartography(name) : ({
    schemaVersion: 5, name, address: null, position: communityGoals && name.startsWith('Synthetic CG ')
      ? [Number(name.slice('Synthetic CG '.length)) * 4000, 0, 4000] : name === 'Colonia' ? [-9530.5, -910.28125, 19808.125] : [0, 0, 0],
    permitRequired: false, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null,
      primaryEconomy: null, secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null, bodies: [], stations: [],
    scanProgress: { knownBodies: 0, reportedBodies: null, percent: null }, localSystem: null,
    provenance: { edsm: { fetchedAt: new Date().toISOString() }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  }) }
})
const { port } = await application.start()
copilotOrigin = `http://127.0.0.1:${port}`
if (missionBrief) {
  const database = new SqliteDatabase(databasePath)
  try {
    database.initialize()
    const missions = new MissionDataService(database)
    missions.ingest({
      timestamp: '2026-10-10T12:00:00Z', event: 'MissionAccepted', MissionID: 42,
      Name: 'Mission_OnFoot_Heist_Covert_NCD_MB_name', LocalisedName: 'Retrieve documents',
      DestinationSystem: 'Sol', DestinationSettlement: 'Synthetic research base',
      Commodity: 'personalDocuments', Commodity_Localised: 'Personal documents', Count: 1,
      Target: 'Synthetic contact', TargetType: '$MissionContact;', TargetType_Localised: 'Contact',
      TargetFaction: 'Synthetic researchers', Reward: 100000
    }, 'live-journal')
    application.ingestGameEvent({
      schemaVersion: 1, id: 'synthetic-mission-items', type: 'inventory.backpack_changed',
      source: 'synthetic', gameTimestamp: '2026-10-10T12:05:00Z', ingestedAt: new Date().toISOString(),
      payload: parseMicroResourceInventory({
        timestamp: '2026-10-10T12:05:00Z', event: 'Backpack',
        Items: [{ Name: 'personalDocuments', Name_Localised: 'Personal documents', Count: 1, MissionID: 42 }]
      })
    })
  } finally { database.close() }
}
if (galnetArchive) {
  const connection = new DatabaseSync(databasePath)
  try {
    const archive = new SqliteGalnetArticleArchive(connection)
    archive.observe(Array.from({ length: 45 }, (_, index) => ({
      ...continuityArticles[0], id: `synthetic-archive-${String(index).padStart(2, '0')}`,
      title: `Retained synthetic broadcast ${index}`, body: `Archived beacon evidence ${index}.`,
      sourceUrl: `https://example.com/galnet/synthetic-archive-${index}`,
      publishedAt: '2026-09-01T12:00:00Z'
    })), '2026-10-08T12:00:00Z')
  } finally { connection.close() }
}
if (eddnSubmissions) {
  const connection = new DatabaseSync(databasePath)
  try {
    const outbox = new SqliteEddnOutbox(connection)
    const now = Date.now()
    for (let index = 0; index < 30; index++) {
      const time = now - (30 - index) * 60_000
      const id = `preview-${index}`
      const outcome = ['accepted', 'retry', 'rejected', 'interrupted'][index % 4]
      outbox.enqueue(id, {
        $schemaRef: 'https://eddn.edcd.io/schemas/journal/1/test',
        header: { softwareName: 'PHOENIX', softwareVersion: '0.1.2', uploaderID: 'Preview commander', gameversion: '4.0', gamebuild: 'preview' },
        message: { event: index % 2 ? 'FSDJump' : 'Scan', timestamp: new Date(time).toISOString(), StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0] }
      }, time)
      const attempt = outbox.beginAttempt(id, time + 75_000, time)
      outbox.finishAttempt(attempt, outcome, outcome === 'accepted' ? 200 : outcome === 'retry' ? 503 : outcome === 'rejected' ? 400 : null, time + 1000, outcome === 'retry' ? time + 60_000 : undefined)
      if (outcome === 'accepted') outbox.acknowledge(id, time + 1000)
      else if (outcome === 'rejected') outbox.drop(id, 'rejected', time + 1000)
      else if (outcome === 'retry') outbox.retry(id, time + 60_000)
    }
  } finally { connection.close() }
}
application.ingestGameEvent({
  schemaVersion: 1, id: 'isolated-preview', type: 'system.changed', source: 'synthetic',
  gameTimestamp: null, ingestedAt: new Date().toISOString(),
  payload: { ...createEmptyRuntimeState().system, name: 'Sol', position: [0, 0, 0] }
})
console.log(`Isolated preview: http://127.0.0.1:${port}`)
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  await application.stop()
  if (fixtureDirectory) rmSync(fixtureDirectory, { recursive: true, force: true })
  process.exit(0)
})
