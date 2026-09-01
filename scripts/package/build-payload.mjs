import { createHash } from 'node:crypto'
import { cpSync, chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const outputRoot = resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const allowedRoot = resolve(projectRoot, 'dist/payload')

if (!isWithin(outputRoot, allowedRoot)) throw new Error('Payload output must remain under dist/payload.')
rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })

copy('apps/web/dist')
copy('agents')
copy('LICENSE')
copy('resources/catalogue')
copy('apps/web/public/phoenix.svg', 'resources/phoenix.svg')
copy('scripts/catalogue')
copy('scripts/package/launcher.mjs')
copy('package.json')

const serverEntrypoint = resolve(outputRoot, 'apps/server/dist/main.js')
mkdirSync(dirname(serverEntrypoint), { recursive: true })
await build({
  banner: {
    js: "import { createRequire as __phoenixCreateRequire } from 'node:module'; const require = __phoenixCreateRequire(import.meta.url);"
  },
  bundle: true,
  entryPoints: [resolve(projectRoot, 'apps/server/src/main.ts')],
  format: 'esm',
  legalComments: 'none',
  logLevel: 'warning',
  outfile: serverEntrypoint,
  platform: 'node',
  target: 'node24'
})

const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node'
copyAbsolute(process.execPath, resolve(outputRoot, 'runtime', runtimeName))
chmodSync(resolve(outputRoot, 'runtime', runtimeName), 0o755)

const manifest = {
  application: 'PHOENIX',
  architecture: process.arch,
  channel: process.env.PHOENIX_RELEASE_CHANNEL ?? 'development',
  entrypoint: 'apps/server/dist/main.js',
  files: checksums(outputRoot),
  node: process.version,
  platform: process.platform,
  version: packageJson.version
}
writeFileSync(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`PHOENIX payload staged at ${outputRoot}`)
console.log(`${Object.keys(manifest.files).length} files · ${formatBytes(directorySize(outputRoot))}`)

function copy (source, destination = source) {
  copyAbsolute(resolve(projectRoot, source), resolve(outputRoot, destination))
}

function copyAbsolute (source, destination) {
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { dereference: true, recursive: statSync(source).isDirectory() })
}

function checksums (root) {
  return Object.fromEntries(files(root)
    .filter(path => basename(path) !== 'manifest.json')
    .map(path => [relative(root, path).split(sep).join('/'), sha256(path)]))
}

function files (directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? files(path) : [path]
    })
}

function sha256 (path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function directorySize (directory) {
  return files(directory).reduce((total, path) => total + statSync(path).size, 0)
}

function formatBytes (bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

function isWithin (candidate, parent) {
  const path = relative(parent, candidate)
  return path !== '' && !path.startsWith('..') && !path.startsWith(sep)
}
