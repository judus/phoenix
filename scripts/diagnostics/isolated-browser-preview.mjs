// npm run build, then: node --import tsx scripts/diagnostics/isolated-browser-preview.mjs
// In-memory browser diagnostics only: no real journals, game input, or provider requests.
// Add --prospecting for a synthetic pre-Odyssey candidate with unknown signal counts.
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { PhoenixApplication } from '../../apps/server/src/phoenix-application.ts'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { mockDenseCartography } from './mock-dense-cartography.mjs'
import { SqliteEddnOutbox } from '../../apps/server/src/infrastructure/sqlite-eddn-outbox.ts'

const require = createRequire(import.meta.url)
const { RecordingKeyboardOutput } = require('control-deck/adapter-keyboard')
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const denseCartography = process.argv.includes('--dense-cartography')
const eddnSubmissions = process.argv.includes('--eddn-submissions')
const prospecting = process.argv.includes('--prospecting')
const atlasPois = process.argv.includes('--atlas-pois')
const fixtureDirectory = eddnSubmissions ? mkdtempSync(join(tmpdir(), 'phoenix-eddn-preview-')) : undefined
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
  copilot: null,
  copilotRealtime: null,
  openAiEnvironmentKey: null,
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
    schemaVersion: 5, name, address: null, position: [0, 0, 0],
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
      outbox.discard(id)
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
