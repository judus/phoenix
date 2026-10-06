import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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
