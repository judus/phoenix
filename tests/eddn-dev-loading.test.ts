import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect, test } from 'vitest'

test('development ESM loader compiles EDDN schemas and validates messages', () => {
  // Vitest transforms imports differently from the actual tsx development runner.
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    const { EddnSchemaValidator } = await import('./apps/server/src/infrastructure/eddn-schema-validator.ts')
    const { EddnMessageBuilder } = await import('./apps/server/src/domain/eddn-message-builder.ts')
    const validator = new EddnSchemaValidator('resources/eddn')
    const builder = new EddnMessageBuilder('test')
    const timestamp = '2026-10-06T12:00:00Z'
    builder.observe({ event: 'Fileheader', timestamp, gameversion: '4.0', build: 'test' })
    builder.observe({ event: 'LoadGame', timestamp, Commander: 'Test' })
    const location = { event: 'Location', timestamp, StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0] }
    builder.observe(location)
    const message = builder.journal(location)
    assert.equal(validator.valid(message), true)
    assert.equal(validator.valid({ ...message, message: { ...message.message, timestamp: 'invalid' } }), false)
  `], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
    timeout: 10_000
  })
  expect(result.error).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
})

test('installer bundling includes the EDDN validator dependencies', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-eddn-bundle-'))
  try {
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL('../apps/server/src/infrastructure/eddn-schema-validator.ts', import.meta.url))],
      bundle: true, format: 'esm', platform: 'node', target: 'node24', write: false,
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
    })
    const schemas = fileURLToPath(new URL('../resources/eddn', import.meta.url))
    const script = join(directory, 'validator.mjs')
    writeFileSync(script, `${bundle.outputFiles[0].text}
      new EddnSchemaValidator(${JSON.stringify(schemas)});
    `)
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8', timeout: 10_000 })
    // Execute outside the repository: no ancestor node_modules can mask a missing bundle.
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
