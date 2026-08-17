import { createHash } from 'node:crypto'
import { accessSync, constants, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const payloadRoot = resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const manifest = JSON.parse(readFileSync(resolve(payloadRoot, 'manifest.json'), 'utf8'))

for (const [path, expected] of Object.entries(manifest.files)) {
  const file = resolve(payloadRoot, path)
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex')
  if (actual !== expected) throw new Error(`Payload checksum mismatch: ${path}`)
}

const runtime = resolve(payloadRoot, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
accessSync(runtime, constants.X_OK)
for (const required of [
  'apps/server/dist/main.js',
  'apps/web/dist/index.html',
  'agents/marin/agent.md',
  'data/catalogue/ships.json',
  'node_modules/@phoenix/contracts/dist/index.js',
  'node_modules/@jdu/llm-client/dist/index.js'
]) {
  readFileSync(resolve(payloadRoot, required))
}

console.log(`PHOENIX payload verified: ${Object.keys(manifest.files).length} checksums valid.`)
