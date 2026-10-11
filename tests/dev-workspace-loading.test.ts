import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { expect, test } from 'vitest'

const root = fileURLToPath(new URL('../', import.meta.url))

test.each(['development', 'production'])('Node %s resolution loads the intended workspace entrypoints', mode => {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', ...(mode === 'development' ? ['--conditions=development'] : []),
    'scripts/diagnostics/workspace-source-probe.mjs'
  ], { cwd: root, encoding: 'utf8', timeout: 10_000 })
  expect(result.error).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  for (const name of ['contracts', 'elite', 'copilot']) {
    expect(result.stdout).toContain(`/packages/${name}/${mode === 'development' ? 'src/index.ts' : 'dist/index.js'}`)
  }
})

test('Vite development resolves contracts to source, not a one-off predev build', async () => {
  const server = await createServer({
    root: `${root}apps/web`,
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }
  })
  try {
    const resolved = await server.environments.client.pluginContainer.resolveId('@phoenix/contracts', `${root}apps/web/src/main.tsx`)
    expect(resolved?.id.replaceAll('\\', '/')).toBe(`${root}packages/contracts/src/index.ts`.replaceAll('\\', '/'))
  } finally { await server.close() }
})
