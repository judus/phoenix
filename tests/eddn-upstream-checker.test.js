import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, test, vi } from 'vitest'
import { checkUpstream, formatReport, githubClient, main, validatePins } from '../scripts/eddn/check-upstream.mjs'

const pinned = '1'.repeat(40)
const latest = '2'.repeat(40)
const treeRevision = '3'.repeat(40)
const nextTree = '4'.repeat(40)
const bytes = Buffer.from('{"fixture":true}\n')
const hash = createHash('sha256').update(bytes).digest('hex')
const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const other = '5'.repeat(40)
const pins = {
  eddn: { repository: 'EDCD/EDDN', branch: 'live', revision: pinned },
  edmc: { repository: 'EDCD/EDMarketConnector', branch: 'main', revision: pinned, reviewPaths: ['plugins/eddn.py', 'monitor.py', 'companion.py'] },
  schemas: { 'journal-v1.0.json': hash }
}
const baseFiles = {
  eddn: { 'schemas/journal-v1.0.json': blob, 'schemas/journal-README.md': blob, 'docs/Developers.md': blob,
    'schemas/fcmaterials_capi-v1.0.json': other, 'schemas/blackmarket-v1.0.json': other,
    'schemas/TEMPLATES/journalevent-v1.0.json': other },
  edmc: { 'plugins/eddn.py': blob, 'monitor.py': blob, 'companion.py': blob }
}

function fixture({ changed = false, files = baseFiles, fail } = {}) {
  const getJson = vi.fn(async path => {
    const source = path.startsWith('EDCD/EDDN/') ? 'eddn' : 'edmc'
    if (source === fail) throw new Error('Synthetic offline failure')
    if (path.includes('/commits/')) {
      const current = !path.endsWith(pinned) && changed
      return { sha: current ? latest : pinned, commit: { tree: { sha: current ? nextTree : treeRevision } } }
    }
    const current = path.includes(nextTree)
    return { sha: current ? nextTree : treeRevision, truncated: false,
      tree: Object.entries(current ? files[source] : baseFiles[source]).map(([path, sha]) => ({ path, sha, type: 'blob' })) }
  })
  return { pins: structuredClone(pins), readSchema: () => bytes, getJson }
}

describe('read-only EDDN upstream review', () => {
  test('unchanged references verify Git blob identity, ignore templates and report existing unbundled families without drift', async () => {
    const options = fixture()
    const report = await checkUpstream(options)
    expect(report.status).toBe('unchanged')
    expect(options.getJson).toHaveBeenCalledTimes(4)
    expect(report.sources.eddn).toMatchObject({ pinnedRevision: pinned, currentRevision: pinned, schemaChanges: [], documentationChanges: [], notBundledSchemas: ['schemas/blackmarket-v1.0.json', 'schemas/fcmaterials_capi-v1.0.json'] })
    expect(report.sources.edmc.uploaderChanges).toEqual([])
    expect(formatReport(report)).toContain('not new drift')
    expect(formatReport(report)).toContain('does not establish EDDN readiness')
  })
  test('finds added/changed/removed schemas, policy and mapping changes against immutable baseline trees', async () => {
    const files = structuredClone(baseFiles)
    files.eddn['schemas/journal-v1.0.json'] = other
    delete files.eddn['schemas/blackmarket-v1.0.json']
    files.eddn['schemas/newfamily-v1.0.json'] = other
    files.eddn['schemas/journal-README.md'] = other
    files.eddn['docs/Developers.md'] = other
    files.edmc['plugins/eddn.py'] = other
    delete files.edmc['monitor.py']
    const options = fixture({ changed: true, files })
    const report = await checkUpstream(options)
    expect(report.status).toBe('review-required')
    expect(report.sources.eddn.schemaChanges).toEqual([
      { path: 'schemas/blackmarket-v1.0.json', change: 'removed' },
      { path: 'schemas/journal-v1.0.json', change: 'changed' },
      { path: 'schemas/newfamily-v1.0.json', change: 'added' }
    ])
    expect(report.sources.eddn.documentationChanges).toHaveLength(2)
    expect(report.sources.edmc.uploaderChanges).toEqual([{ path: 'monitor.py', change: 'removed' }, { path: 'plugins/eddn.py', change: 'changed' }])
    expect(options.getJson).toHaveBeenCalledTimes(8)
    expect(formatReport(report)).toContain(`https://github.com/EDCD/EDDN/compare/${pinned}...${latest}`)
  })
  test('revision drift alone still requests review', async () => {
    const report = await checkUpstream(fixture({ changed: true }))
    expect(report.status).toBe('review-required')
    expect(report.sources.eddn.schemaChanges).toEqual([])
  })
  test('one failing source retains the other result but never claims all clear', async () => {
    const report = await checkUpstream(fixture({ fail: 'edmc' }))
    expect(report.status).toBe('incomplete')
    expect(report.sources.eddn).toBeDefined()
    expect(report.errors).toEqual([{ source: 'edmc', problem: 'Synthetic offline failure' }])
  })
  test.each(['truncated', 'malformed', 'duplicate'])('rejects %s metadata rather than comparing an incomplete tree', async failure => {
    const options = fixture()
    const original = options.getJson
    options.getJson = async path => {
      const value = await original(path)
      if (value.tree) {
        if (failure === 'truncated') value.truncated = true
        if (failure === 'malformed') value.tree[0].sha = 'invalid'
        if (failure === 'duplicate') value.tree.push(value.tree[0])
      }
      return value
    }
    expect((await checkUpstream(options)).status).toBe('incomplete')
  })
  test('rejects schema tampering even if upstream is unchanged', async () => {
    const options = fixture()
    options.readSchema = () => Buffer.from('tampered')
    const report = await checkUpstream(options)
    expect(report.status).toBe('incomplete')
    expect(report.localSchemaErrors.map(error => error.problem)).toEqual(['SHA-256 differs from the pin', 'Local bytes do not match the pinned upstream blob'])
  })
  test('missing local files and missing pinned EDMC paths are visible failures', async () => {
    const options = fixture()
    options.readSchema = () => { throw new Error('Synthetic missing file') }
    options.pins.edmc.reviewPaths.push('missing.py')
    const report = await checkUpstream(options)
    expect(report.status).toBe('incomplete')
    expect(report.localSchemaErrors[0].problem).toContain('could not be read')
    expect(report.errors[0].problem).toContain('missing.py')
  })
  test('validates local manifest filenames before passing them to file reads', async () => {
    const options = fixture()
    options.pins.schemas = { '../escape.json': hash }
    options.readSchema = vi.fn()
    await expect(checkUpstream(options)).rejects.toThrow('Invalid local schema filename')
    expect(options.readSchema).not.toHaveBeenCalled()
  })
  test('the actual bundled pin manifest validates', () => {
    expect(() => validatePins(JSON.parse(readFileSync('resources/eddn/upstream.json', 'utf8')))).not.toThrow()
  })
  test('vendored schema checkout preserves upstream bytes even with core.autocrlf enabled', () => {
    const actual = JSON.parse(readFileSync('resources/eddn/upstream.json', 'utf8'))
    const paths = Object.keys(actual.schemas).map(name => `resources/eddn/${name}`)
    const attributes = execFileSync('git', ['-c', 'core.autocrlf=true', 'check-attr', 'text', '--', ...paths], { encoding: 'utf8' })
    expect(attributes.trim().split(/\r?\n/)).toEqual(paths.map(path => `${path}: text: unset`))
    for (const name of Object.keys(actual.schemas)) {
      expect(createHash('sha256').update(readFileSync(`resources/eddn/${name}`)).digest('hex')).toBe(actual.schemas[name])
    }
  })
})

test('HTTP client is GET-only, bounded, refuses redirects, does not retry or expose response/token on rate limits', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403, text: vi.fn() })
  const client = githubClient(fetcher, 'synthetic-secret')
  await expect(client('EDCD/EDDN/commits/live')).rejects.toThrow('read-only GITHUB_TOKEN')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('https://api.github.com/repos/EDCD/EDDN/commits/live', expect.objectContaining({ method: 'GET', redirect: 'error', signal: expect.any(AbortSignal) }))
})

test('CLI rejects unknown options without making network requests', () => {
  try { execFileSync(process.execPath, ['scripts/eddn/check-upstream.mjs', '--json', '--unknown'], { encoding: 'utf8' }); throw new Error('Expected failure') }
  catch (error) {
    expect(error.status).toBe(2)
    expect(JSON.parse(error.stdout)).toMatchObject({ status: 'incomplete', errors: [{ source: 'checker', problem: expect.stringContaining('Unknown argument') }] })
  }
})

test.each(['unchanged', 'review-required', 'incomplete'])('CLI JSON reports %s with its documented exit code without live requests', async status => {
  const actual = JSON.parse(readFileSync('resources/eddn/upstream.json', 'utf8'))
  const blobs = Object.fromEntries(Object.keys(actual.schemas).map(name => {
    const data = readFileSync(`resources/eddn/${name}`)
    return [`schemas/${name}`, createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex')]
  }))
  const fetcher = vi.fn(async url => {
    if (status === 'incomplete') throw new DOMException('Synthetic timeout', 'TimeoutError')
    const source = url.includes('/EDDN/') ? actual.eddn : actual.edmc
    const current = status === 'review-required' && !url.endsWith(source.revision)
    const data = url.includes('/commits/')
      ? { sha: current ? latest : source.revision, commit: { tree: { sha: treeRevision } } }
      : { sha: treeRevision, truncated: false, tree: Object.entries(source === actual.eddn ? blobs : baseFiles.edmc).map(([path, sha]) => ({ path, sha, type: 'blob' })) }
    return { ok: true, json: async () => data }
  })
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubGlobal('fetch', fetcher)
  try {
    const exitCode = await main(['--json'])
    const report = JSON.parse(log.mock.calls.at(-1)[0])
    expect(report).toMatchObject({ status })
    expect(exitCode).toBe({ unchanged: 0, 'review-required': 1, incomplete: 2 }[status])
    expect(fetcher).toHaveBeenCalled()
  } finally { vi.unstubAllGlobals(); log.mockRestore() }
})
