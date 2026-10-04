import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { validateBlueprintGradeKeys } from '../scripts/catalogue/validate-blueprint-grade-keys.mjs'

test('fresh blueprint keys accept all canonical grades, sparse maps and empty maps without mutation', () => {
  const source = {
    Sparse: { grades: { '5': { components: { Carbon: 2 } }, '1': { components: { Iron: 1 } } } },
    Full: { grades: Object.fromEntries(['1', '2', '3', '4', '5'].map(key => [key, {}])) },
    Empty: { grades: {} },
    Missing: {}
  }
  const before = structuredClone(source)
  expect(() => validateBlueprintGradeKeys(source)).not.toThrow()
  expect(source).toEqual(before)
})

test.each(['01', '1suffix', '1.5', ' 1', '+1', '6', '0', '-1', 'invalid', ''])('fresh output explicitly rejects noncanonical grade key %j', key => {
  expect(() => validateBlueprintGradeKeys({ Weapon_Overcharged: { grades: { [key]: {} } } }))
    .toThrow(`Blueprint Weapon_Overcharged has unsupported grade key ${JSON.stringify(key)}.`)
})

test('all bundled official blueprint keys satisfy fresh producer validation', () => {
  const records = JSON.parse(readFileSync(new URL('../resources/catalogue/engineering/blueprints.json', import.meta.url), 'utf8'))
  expect(() => validateBlueprintGradeKeys(Object.fromEntries(records.map(record => [record.symbol, record])))).not.toThrow()
})

test('the actual refresh command rejects invalid upstream grade keys before touching the retained snapshot', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'phoenix-grade-refresh-'))
  const previous = {
    'manifest.json': '{"schemaVersion":5,"retained":true}',
    'commodities.json': '{"retainedCommodity":true}',
    'keep.txt': 'retained user snapshot'
  }
  for (const [name, content] of Object.entries(previous)) writeFileSync(join(temporary, name), content)
  // Child-local fetch fixture: no live network, data, repositories or refreshes.
  const fixture = `globalThis.fetch = async input => {
    const url = String(input);
    if (!url.startsWith('https://api.github.com/') && !url.startsWith('https://raw.githubusercontent.com/')) throw new Error('Unexpected fixture URL');
    const value = url.includes('/commits/') ? { sha: 'fixture-revision' }
      : url.includes('/git/trees/') ? { tree: [] }
      : url.endsWith('/modifications/blueprints.json') ? { Weapon_Overcharged: { grades: { '1suffix': {} } } }
      : {};
    return new Response(JSON.stringify(value), { status: 200 });
  };`
  try {
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(fixture)}`,
      fileURLToPath(new URL('../scripts/catalogue/refresh.mjs', import.meta.url)),
      '--output', temporary, '--force'
    ], { encoding: 'utf8', timeout: 10_000 })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Blueprint Weapon_Overcharged has unsupported grade key "1suffix"')
    expect(result.stderr).toContain('existing catalogue snapshot has not been replaced')
    expect(readdirSync(temporary).sort()).toEqual(Object.keys(previous).sort())
    for (const [name, content] of Object.entries(previous)) expect(readFileSync(join(temporary, name), 'utf8')).toBe(content)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})
