import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compiler = join(root, 'node_modules/typescript/bin/tsc')

test('strict test configuration covers every TypeScript test and helper without emitting', () => {
  const config = JSON.parse(execFileSync(process.execPath, [compiler, '-p', 'tsconfig.tests.json', '--showConfig'], { cwd: root, encoding: 'utf8' }))
  expect(config.compilerOptions).toMatchObject({ strict: true, noEmit: true })
  expect(config.compilerOptions.skipLibCheck).not.toBe(true)
  const files = new Set(config.files.map((file: string) => resolve(root, file)))
  for (const file of readdirSync(join(root, 'tests'), { recursive: true }).map(String).filter(file => /\.tsx?$/u.test(file))) {
    expect(files.has(join(root, 'tests', file)), `Missing compiler coverage: ${file}`).toBe(true)
  }
  const scripts = JSON.parse(execFileSync(process.execPath, ['-p', 'JSON.stringify(require("./package.json").scripts)'], { cwd: root, encoding: 'utf8' }))
  expect(scripts.check.split(' && ')).toContain('npm run typecheck:tests')
})

test('test compiler rejects implicit any, nullability and incomplete API fixtures', () => {
  // Keep normal ancestor node_modules resolution, just like an actual test file.
  const directory = mkdtempSync(join(root, 'tests', '.typecheck-probe-'))
  try {
    const apiPath = join(root, 'apps/web/src/application/api/phoenix-api.js').replaceAll('\\', '/')
    writeFileSync(join(directory, 'probe.ts'), `
      import type { PhoenixApi } from ${JSON.stringify(apiPath)}
      function identity(value) { return value }
      const label: string = null
      const api: Partial<PhoenixApi> = {
        getPairingStatus: async () => ({ authenticated: true, installationId: 'test', pairingRequired: true })
      }
    `)
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
      extends: join(root, 'tsconfig.tests.json'), files: ['./probe.ts'], include: []
    }))
    const result = spawnSync(process.execPath, [compiler, '-p', join(directory, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBeNull()
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('TS7006')
    expect(result.stdout).toContain('TS2322')
    expect(result.stdout).toContain('serverDevice')
    expect(readdirSync(directory)).not.toContain('probe.js')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
