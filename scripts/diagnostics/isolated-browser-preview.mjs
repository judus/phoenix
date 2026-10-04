// npm run build, then: node --import tsx scripts/diagnostics/isolated-browser-preview.mjs
// In-memory browser diagnostics only: no real journals, game input, or provider requests.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { PhoenixApplication } from '../../apps/server/src/phoenix-application.ts'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { mockDenseCartography } from './mock-dense-cartography.mjs'

const require = createRequire(import.meta.url)
const { RecordingKeyboardOutput } = require('control-deck/adapter-keyboard')
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const denseCartography = process.argv.includes('--dense-cartography')
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
  databasePath: ':memory:',
  eliteDirectory: null,
  eliteBindingsDirectory: null,
  host: '127.0.0.1',
  port: 0,
  keyboardOutput: new RecordingKeyboardOutput(),
  webRoot: `${projectRoot}apps/web/dist`,
  copilot: null,
  copilotRealtime: null,
  openAiEnvironmentKey: null,
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
application.ingestGameEvent({
  schemaVersion: 1, id: 'isolated-preview', type: 'system.changed', source: 'synthetic',
  gameTimestamp: null, ingestedAt: new Date().toISOString(),
  payload: { ...createEmptyRuntimeState().system, name: 'Sol', position: [0, 0, 0] }
})
console.log(`Isolated preview: http://127.0.0.1:${port}`)
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  await application.stop()
  process.exit(0)
})
