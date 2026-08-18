import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const projectRoot = resolve(import.meta.dirname, '../..')
const repositories = {
  fdevids: { owner: 'EDCD', name: 'FDevIDs', branch: 'master' },
  coriolis: { owner: 'EDCD', name: 'coriolis-data', branch: 'master' }
}
const coreNames = ['Power Plant', 'Thrusters', 'Frame Shift Drive', 'Life Support', 'Power Distributor', 'Sensors', 'Fuel Tank']

const options = parseOptions(process.argv.slice(2))
const outputDirectory = resolve(projectRoot, options.output)
const manifestPath = join(outputDirectory, 'manifest.json')

if (!options.force && await isFresh(manifestPath, options.maxAgeHours)) {
  console.log(`Catalogue check skipped; ${manifestPath} is still fresh.`)
  process.exit(0)
}

const revisions = {
  fdevids: await latestRevision(repositories.fdevids),
  coriolis: await latestRevision(repositories.coriolis)
}
const currentManifest = await readJsonIfPresent(manifestPath)
if (!options.force && currentManifest?.sources?.fdevids === revisions.fdevids && currentManifest?.sources?.coriolis === revisions.coriolis) {
  await writeJsonAtomic(manifestPath, { ...currentManifest, checkedAt: new Date().toISOString() })
  console.log('Catalogue sources are already current.')
  process.exit(0)
}

console.log(`Refreshing catalogues from FDevIDs ${short(revisions.fdevids)} and Coriolis ${short(revisions.coriolis)}…`)
const [outfittingCsv, materialsCsv, engineersCsv, shipyardCsv, blueprintsSource, modifications, blueprintModules, shipPaths] = await Promise.all([
  rawText(repositories.fdevids, revisions.fdevids, 'outfitting.csv'),
  rawText(repositories.fdevids, revisions.fdevids, 'material.csv'),
  rawText(repositories.fdevids, revisions.fdevids, 'engineers.csv'),
  rawText(repositories.fdevids, revisions.fdevids, 'shipyard.csv'),
  rawJson(repositories.coriolis, revisions.coriolis, 'modifications/blueprints.json'),
  rawJson(repositories.coriolis, revisions.coriolis, 'modifications/modifications.json'),
  rawJson(repositories.coriolis, revisions.coriolis, 'modifications/modules.json'),
  repositoryPaths(repositories.coriolis, revisions.coriolis, /^ships\/[^/]+\.json$/u)
])
const shipFiles = await mapConcurrent(shipPaths, 8, async path => [path, await rawJson(repositories.coriolis, revisions.coriolis, path)])

const outfitting = parseCsv(outfittingCsv)
const materials = parseCsv(materialsCsv)
const engineerRows = parseCsv(engineersCsv)
const shipyard = parseCsv(shipyardCsv)
const generatedAt = new Date().toISOString()
const blueprints = buildBlueprints(blueprintsSource, modifications, blueprintModules)
const engineers = await buildEngineers(engineerRows, blueprints)
const files = {
  'modules.json': buildModules(outfitting, revisions.fdevids, generatedAt),
  'ships.json': buildShips(shipFiles, shipyard, revisions.coriolis, generatedAt),
  'engineering/blueprints.json': blueprints,
  'engineering/engineers.json': engineers,
  'engineering/materials.json': materials,
  'engineering/material-uses.json': buildMaterialUses(materials, blueprints),
  'manifest.json': {
    schemaVersion: 1,
    generatedAt,
    checkedAt: generatedAt,
    sources: revisions,
    counts: {
      ships: shipFiles.length,
      modules: outfitting.length,
      blueprints: blueprints.length,
      engineers: engineers.length,
      materials: materials.length
    }
  }
}

validate(files)
await replaceSnapshot(outputDirectory, files)
console.log(`Catalogue snapshot refreshed in ${outputDirectory}.`)

function parseOptions (arguments_) {
  const result = { output: 'data/runtime/catalogue', maxAgeHours: 24, force: false }
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === '--force') result.force = true
    else if (argument === '--output') result.output = requiredValue(arguments_, ++index, argument)
    else if (argument === '--max-age-hours') result.maxAgeHours = Number(requiredValue(arguments_, ++index, argument))
    else throw new Error(`Unknown catalogue refresh option: ${argument}`)
  }
  if (!Number.isFinite(result.maxAgeHours) || result.maxAgeHours < 0) throw new Error('max-age-hours must be non-negative.')
  return result
}

function requiredValue (arguments_, index, option) {
  const value = arguments_[index]
  if (!value) throw new Error(`${option} requires a value.`)
  return value
}

async function isFresh (path, maxAgeHours) {
  const manifest = await readJsonIfPresent(path)
  const checkedAt = Date.parse(manifest?.checkedAt ?? '')
  return Number.isFinite(checkedAt) && Date.now() - checkedAt < maxAgeHours * 3_600_000
}

async function latestRevision (repository) {
  const data = await fetchJson(`https://api.github.com/repos/${repository.owner}/${repository.name}/commits/${repository.branch}`)
  if (typeof data.sha !== 'string' || data.sha.length < 7) throw new Error(`Invalid revision response for ${repository.name}.`)
  return data.sha
}

async function repositoryPaths (repository, revision, pattern) {
  const data = await fetchJson(`https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${revision}?recursive=1`)
  if (!Array.isArray(data.tree)) throw new Error(`Invalid repository tree for ${repository.name}.`)
  return data.tree.map(entry => entry.path).filter(path => typeof path === 'string' && pattern.test(path)).sort()
}

async function rawText (repository, revision, path) {
  return fetchText(`https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${revision}/${path}`)
}

async function rawJson (repository, revision, path) {
  return JSON.parse(await rawText(repository, revision, path))
}

async function fetchJson (url) {
  return JSON.parse(await fetchText(url))
}

async function fetchText (url) {
  let failure
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'PHOENIX-catalogue-refresh' },
        signal: AbortSignal.timeout(30_000)
      })
      if (!response.ok) throw new Error(`Catalogue source request failed (${response.status} ${response.statusText}): ${url}`)
      return response.text()
    } catch (error) {
      failure = error
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw failure
}

function parseCsv (source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted && character === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (!quoted && character === ',') { row.push(field); field = '' }
    else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some(value => value.length > 0)) rows.push(row)
      row = []
    } else field += character
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  const [headers = [], ...values] = rows
  return values.map(items => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])))
}

function buildModules (rows, revision, generatedAt) {
  const ratings = { 1: 'E', 2: 'D', 3: 'C', 4: 'B', 5: 'A' }
  return {
    schemaVersion: 1,
    source: { name: 'EDCD FDevIDs', repository: 'https://github.com/EDCD/FDevIDs', revision, path: 'outfitting.csv', retrievedAt: generatedAt },
    modules: rows.map(row => ({
      journalId: row.symbol,
      displayName: row.name,
      category: nullable(row.category),
      size: integerOrNull(row.class),
      rating: nullable(row.rating) ?? ratings[Number(row.rating)] ?? null,
      mount: nullable(row.mount),
      guidance: nullable(row.guidance),
      ship: nullable(row.ship)
    }))
  }
}

function buildShips (files, shipyardRows, revision, generatedAt) {
  const shipyardById = new Map(shipyardRows.map(row => [Number(row.id), row]))
  const aliases = {}
  const ships = files.map(([path, document]) => {
    const [id, ship] = Object.entries(document)[0] ?? []
    if (!id || !ship) throw new Error(`Invalid ship file: ${path}`)
    const row = shipyardById.get(Number(ship.edID))
    const displayName = ship.properties?.name ?? row?.name ?? humanize(id)
    for (const alias of [id, displayName, row?.symbol, row?.name]) if (alias) aliases[normalize(alias)] = id
    const hardpoints = ship.slots?.hardpoints ?? []
    return {
      id,
      identifiers: { coriolis: id, frontierEdId: numberOrNull(ship.edID) },
      displayName,
      manufacturer: nullable(ship.properties?.manufacturer),
      landingPadSize: ({ 1: 'small', 2: 'medium', 3: 'large' })[ship.properties?.class] ?? null,
      performance: {
        baseArmour: numberOrNull(ship.properties?.baseArmour),
        baseShieldStrength: numberOrNull(ship.properties?.baseShieldStrength),
        boost: numberOrNull(ship.properties?.boost),
        hullMass: numberOrNull(ship.properties?.hullMass),
        speed: numberOrNull(ship.properties?.speed)
      },
      slots: {
        core: (ship.slots?.standard ?? []).map((slot, index) => ({ name: coreNames[index] ?? `Core ${index + 1}`, size: slotSize(slot) })),
        hardpoints: hardpoints.filter(slot => slotSize(slot) > 0).map(slotDefinition),
        optional: (ship.slots?.internal ?? []).map(slotDefinition),
        utilities: hardpoints.filter(slot => slotSize(slot) === 0).map(slotDefinition)
      },
      source: { file: path.replace(/^ships\//u, '') }
    }
  }).sort((left, right) => left.displayName.localeCompare(right.displayName))
  return {
    schemaVersion: 1,
    source: { name: 'EDCD Coriolis Data', repository: 'https://github.com/EDCD/coriolis-data', commit: revision, path: 'ships', retrievedAt: generatedAt },
    generatedAt,
    aliases,
    ships
  }
}

function slotDefinition (slot) {
  if (typeof slot === 'number') return { size: slot }
  const result = { size: slotSize(slot) }
  if (slot.name) result.name = slot.name
  if (slot.eligible && typeof slot.eligible === 'object') result.eligible = slot.eligible
  return result
}

function slotSize (slot) { return typeof slot === 'number' ? slot : Number(slot?.class ?? 0) }

function buildBlueprints (source, modifications, moduleGroups) {
  const engineerGrades = new Map()
  for (const group of Object.values(moduleGroups)) {
    for (const [symbol, blueprint] of Object.entries(group.blueprints ?? {})) {
      const target = engineerGrades.get(symbol) ?? new Map()
      for (const [grade, detail] of Object.entries(blueprint.grades ?? {})) {
        for (const engineer of detail.engineers ?? []) {
          const grades = target.get(engineer) ?? new Set()
          grades.add(Number(grade)); target.set(engineer, grades)
        }
      }
      engineerGrades.set(symbol, target)
    }
  }
  return Object.entries(source).map(([symbol, blueprint]) => ({
    ...blueprint,
    fdname: blueprint.fdname ?? symbol,
    symbol,
    modulename: (blueprint.modulename ?? []).map(name => name.replace('mainentance', 'maintenance')),
    engineers: Object.fromEntries([...((engineerGrades.get(symbol) ?? new Map()).entries())].map(([name, grades]) => [name, { grades: [...grades].sort() }])),
    grades: Object.fromEntries(Object.entries(blueprint.grades ?? {}).map(([grade, value]) => [grade, {
      ...value,
      features: Object.fromEntries(Object.entries(value.features ?? {}).map(([key, feature]) => {
        const metadata = modifications[key] ?? {}
        return [humanize(metadata.name ?? key), {
          value: feature,
          type: metadata.type ?? 'absolute',
          method: metadata.method ?? null,
          improvement: metadata.higherbetter ?? true
        }]
      }))
    }]))
  })).sort((left, right) => left.symbol.localeCompare(right.symbol))
}

async function buildEngineers (rows, blueprints) {
  const specialties = new Map()
  for (const blueprint of blueprints) for (const engineer of Object.keys(blueprint.engineers)) {
    const values = specialties.get(engineer) ?? new Set()
    for (const name of blueprint.modulename) values.add(name)
    specialties.set(engineer, values)
  }
  return mapConcurrent(rows, 5, async row => {
    const location = await lookupSystem(row.system_address)
    const modules = [...(specialties.get(row.name) ?? [])].slice(0, 4)
    return {
      id: row.id,
      systemAddress: row.system_address,
      marketId: row.market_id,
      name: row.name,
      description: modules.length > 0 ? modules.join(', ') : 'Engineering workshop',
      systemName: location.name,
      systemPosition: location.coordinates
    }
  })
}

async function lookupSystem (systemAddress) {
  const data = await fetchJson(`https://www.edsm.net/api-v1/system?systemId64=${encodeURIComponent(systemAddress)}&showCoordinates=1`)
  if (typeof data.name !== 'string' || !data.coords) throw new Error(`EDSM could not resolve engineer system ${systemAddress}.`)
  return { name: data.name, coordinates: [data.coords.x, data.coords.y, data.coords.z] }
}

function buildMaterialUses (materials, blueprints) {
  const byName = new Map(materials.map(material => [normalize(material.name), material]))
  const uses = new Map(materials.map(material => [material.symbol, []]))
  for (const blueprint of blueprints) {
    const gradeMap = new Map()
    for (const [grade, detail] of Object.entries(blueprint.grades)) for (const component of Object.keys(detail.components ?? {})) {
      const material = byName.get(normalize(component))
      if (!material) continue
      const grades = gradeMap.get(material.symbol) ?? []
      grades.push(Number(grade)); gradeMap.set(material.symbol, grades)
    }
    for (const [symbol, grades] of gradeMap) uses.get(symbol)?.push({ symbol: blueprint.symbol, name: blueprint.name, grades: [...new Set(grades)].sort() })
  }
  return materials.map(material => ({ symbol: material.symbol, name: material.name, blueprints: uses.get(material.symbol) ?? [] }))
}

function validate (files) {
  const required = ['modules.json', 'ships.json', 'engineering/blueprints.json', 'engineering/engineers.json', 'engineering/materials.json', 'engineering/material-uses.json']
  for (const path of required) if (!files[path]) throw new Error(`Catalogue output missing ${path}.`)
  if (files['ships.json'].ships.length < 40) throw new Error('Ship catalogue is unexpectedly small.')
  if (files['modules.json'].modules.length < 500) throw new Error('Module catalogue is unexpectedly small.')
  if (files['engineering/blueprints.json'].length < 50) throw new Error('Blueprint catalogue is unexpectedly small.')
  if (files['engineering/materials.json'].length < 100) throw new Error('Material catalogue is unexpectedly small.')
  const unique = (items, key) => new Set(items.map(item => item[key])).size === items.length
  if (!unique(files['ships.json'].ships, 'id')) throw new Error('Duplicate ship IDs detected.')
  if (!unique(files['modules.json'].modules, 'journalId')) throw new Error('Duplicate module IDs detected.')
}

async function replaceSnapshot (target, files) {
  const staging = `${target}.staging-${randomUUID()}`
  await rm(staging, { recursive: true, force: true })
  for (const [relativePath, value] of Object.entries(files)) {
    const path = join(staging, relativePath)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }
  const previous = `${target}.previous`
  await rm(previous, { recursive: true, force: true })
  try { await rename(target, previous) } catch (error) { if (error.code !== 'ENOENT') throw error }
  try {
    await rename(staging, target)
    await rm(previous, { recursive: true, force: true })
  } catch (error) {
    try { await rename(previous, target) } catch {}
    throw error
  }
}

async function writeJsonAtomic (path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

async function readJsonIfPresent (path) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function mapConcurrent (items, concurrency, mapper) {
  const result = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next++; result[index] = await mapper(items[index], index) }
  }))
  return result
}

function normalize (value) { return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_|_$/gu, '') }
function humanize (value) { return String(value).replace(/_/gu, ' ').replace(/\b\w/gu, letter => letter.toUpperCase()) }
function nullable (value) { return value === undefined || value === null || String(value).trim() === '' ? null : value }
function integerOrNull (value) { const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null }
function numberOrNull (value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null }
function short (revision) { return revision.slice(0, 8) }
