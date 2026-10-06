import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const revisionPattern = /^[a-f0-9]{40}$/
const schemaPattern = /^[a-z0-9_]+-v\d+\.\d+\.json$/

export function validatePins(pins) {
  assert.ok(pins && pins.eddn && pins.edmc, 'Pin manifest must contain EDDN and EDMC sources.')
  assert.equal(pins.eddn.repository, 'EDCD/EDDN', 'Unexpected EDDN source repository.')
  assert.equal(pins.edmc.repository, 'EDCD/EDMarketConnector', 'Unexpected EDMC source repository.')
  for (const source of [pins.eddn, pins.edmc]) {
    assert.match(source.revision, revisionPattern, 'Invalid pinned Git revision.')
    assert.ok(typeof source.branch === 'string' && source.branch.length > 0, 'Missing source branch.')
  }
  assert.ok(Array.isArray(pins.edmc.reviewPaths) && pins.edmc.reviewPaths.length > 0, 'Missing EDMC review paths.')
  for (const path of pins.edmc.reviewPaths) assert.ok(typeof path === 'string' && path.length > 0, 'Invalid EDMC review path.')
  assert.ok(pins.schemas && Object.keys(pins.schemas).length > 0, 'Missing pinned schemas.')
  for (const [name, hash] of Object.entries(pins.schemas)) {
    assert.match(name, schemaPattern, 'Invalid local schema filename.')
    assert.match(hash, /^[a-f0-9]{64}$/, 'Invalid schema SHA-256.')
  }
}

/** GET-only client: no uploader, account mutation, response-body logging or automatic retries. */
export function githubClient(fetcher = globalThis.fetch, token) {
  return async path => {
    const response = await fetcher(`https://api.github.com/repos/${path}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    })
    if (!response.ok) {
      const hint = response.status === 403 || response.status === 429
        ? ' Check GitHub rate limits; retry later or use a read-only GITHUB_TOKEN.' : ''
      throw new Error(`GitHub GET ${path} returned HTTP ${response.status}.${hint}`)
    }
    return response.json()
  }
}

async function readSnapshot(getJson, source, revision) {
  const commit = await getJson(`${source.repository}/commits/${encodeURIComponent(revision)}`)
  assert.match(commit.sha, revisionPattern, 'Invalid upstream commit revision.')
  assert.match(commit.commit.tree.sha, revisionPattern, 'Invalid upstream tree revision.')
  const tree = await getJson(`${source.repository}/git/trees/${commit.commit.tree.sha}?recursive=1`)
  assert.equal(tree.sha, commit.commit.tree.sha, 'Upstream tree did not resolve exactly.')
  assert.equal(tree.truncated, false, 'GitHub returned a truncated tree; cannot establish complete coverage.')
  assert.ok(Array.isArray(tree.tree), 'GitHub returned no file tree.')
  const files = new Map()
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue
    assert.ok(typeof entry.path === 'string', 'Invalid upstream file path.')
    assert.match(entry.sha, revisionPattern, 'Invalid upstream file hash.')
    assert.ok(!files.has(entry.path), 'Duplicate upstream file path.')
    files.set(entry.path, entry.sha)
  }
  return { revision: commit.sha, files }
}

function changes(before, after, include) {
  return [...new Set([...before.keys(), ...after.keys()])].filter(include).sort().flatMap(path => {
    const oldHash = before.get(path)
    const newHash = after.get(path)
    return oldHash === newHash ? [] : [{ path, change: !oldHash ? 'added' : !newHash ? 'removed' : 'changed' }]
  })
}

function isSchema(path) {
  return path.startsWith('schemas/') && schemaPattern.test(path.slice('schemas/'.length))
}

function isProtocolDocument(path) {
  return path === 'README.md' || (path.startsWith('docs/') && path.endsWith('.md')) ||
    /^schemas\/[^/]+-README\.md$/.test(path) || path === 'schemas/README-EDDN-schemas.md'
}

export async function checkUpstream({ pins, readSchema, getJson }) {
  validatePins(pins)
  const report = { status: 'unchanged', sources: {}, localSchemaErrors: [], errors: [] }
  const localBlobs = new Map()
  for (const [name, expected] of Object.entries(pins.schemas)) {
    try {
      const bytes = readSchema(name)
      const actual = createHash('sha256').update(bytes).digest('hex')
      if (actual !== expected) report.localSchemaErrors.push({ path: name, problem: 'SHA-256 differs from the pin', expected, actual })
      // Git's object hash checks the local bytes against the pinned upstream file, without downloading code.
      localBlobs.set(`schemas/${name}`, createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'))
    } catch {
      report.localSchemaErrors.push({ path: name, problem: 'Local schema could not be read' })
    }
  }
  await Promise.all(['eddn', 'edmc'].map(async key => {
    const source = pins[key]
    try {
      const current = await readSnapshot(getJson, source, source.branch)
      const baseline = current.revision === source.revision ? current : await readSnapshot(getJson, source, source.revision)
      assert.equal(baseline.revision, source.revision, 'Pinned upstream revision did not resolve exactly.')
      const result = {
        repository: source.repository, branch: source.branch, pinnedRevision: source.revision,
        currentRevision: current.revision, revisionChanged: current.revision !== source.revision,
        compareUrl: `https://github.com/${source.repository}/compare/${source.revision}...${current.revision}`
      }
      if (key === 'eddn') {
        for (const [path, hash] of localBlobs) {
          if (baseline.files.get(path) !== hash) report.localSchemaErrors.push({ path, problem: 'Local bytes do not match the pinned upstream blob' })
        }
        result.schemaChanges = changes(baseline.files, current.files, isSchema)
        result.documentationChanges = changes(baseline.files, current.files, isProtocolDocument)
        result.notBundledSchemas = [...current.files.keys()].filter(isSchema)
          .filter(path => !Object.hasOwn(pins.schemas, path.slice('schemas/'.length))).sort()
      } else {
        for (const path of source.reviewPaths) assert.ok(baseline.files.has(path), `Pinned EDMC review path is missing: ${path}`)
        result.uploaderChanges = changes(baseline.files, current.files, path => source.reviewPaths.includes(path))
      }
      report.sources[key] = result
    } catch (cause) {
      report.errors.push({ source: key, problem: cause instanceof Error ? cause.message : 'Upstream check failed.' })
    }
  }))
  report.errors.sort((a, b) => a.source.localeCompare(b.source))
  report.status = report.errors.length || report.localSchemaErrors.length ? 'incomplete'
    : Object.values(report.sources).some(source => source.revisionChanged) ? 'review-required' : 'unchanged'
  return report
}

export function formatReport(report) {
  const lines = [`EDDN upstream check: ${report.status}`]
  for (const key of ['eddn', 'edmc']) {
    const source = report.sources[key]
    if (!source) continue
    lines.push(`${source.repository} (${source.branch}): ${source.pinnedRevision} -> ${source.currentRevision}`)
    if (source.revisionChanged) lines.push(`  Review revision: ${source.compareUrl}`)
    for (const category of ['schemaChanges', 'documentationChanges', 'uploaderChanges']) {
      for (const entry of source[category] ?? []) lines.push(`  ${category}: ${entry.change} ${entry.path}`)
    }
    if (source.notBundledSchemas?.length) lines.push(`  Not bundled (coverage information, not new drift): ${source.notBundledSchemas.join(', ')}`)
  }
  for (const error of report.localSchemaErrors) lines.push(`Local schema: ${error.path}: ${error.problem}`)
  for (const error of report.errors) lines.push(`${error.source}: ${error.problem}`)
  if (report.status === 'review-required') lines.push('Review upstream differences, privacy allowlists and regressions before deliberately updating pins/mappings.')
  lines.push('Read-only metadata check: no uploads, pin updates or EDMC implementation copied. Unchanged does not establish EDDN readiness/parity.')
  return lines.join('\n')
}

export async function main(args = process.argv.slice(2)) {
  const json = args.includes('--json')
  try {
    for (const arg of args) assert.ok(['--json', '--help'].includes(arg), `Unknown argument: ${arg}. Use --help.`)
    if (args.includes('--help')) {
      console.log('Usage: npm run eddn:check-upstream -- [--json]\nGET-only check of pinned EDDN schemas/docs and EDMC review paths. Exit: 0 unchanged, 1 review required, 2 incomplete/error.\nOptional GITHUB_TOKEN is sent only to api.github.com; no token is needed for public reads within GitHub rate limits.')
      return 0
    }
    const pins = JSON.parse(readFileSync(resolve(root, 'resources/eddn/upstream.json'), 'utf8'))
    const report = await checkUpstream({ pins, readSchema: name => readFileSync(resolve(root, 'resources/eddn', name)), getJson: githubClient(globalThis.fetch, process.env.GITHUB_TOKEN) })
    console.log(json ? JSON.stringify(report, null, 2) : formatReport(report))
    return report.status === 'unchanged' ? 0 : report.status === 'review-required' ? 1 : 2
  } catch (cause) {
    const problem = cause instanceof Error ? cause.message : 'Upstream check failed.'
    if (json) console.log(JSON.stringify({ status: 'incomplete', errors: [{ source: 'checker', problem }] }, null, 2))
    else console.error(`EDDN upstream check incomplete: ${problem}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main()
