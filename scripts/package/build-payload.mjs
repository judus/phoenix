import { createHash } from 'node:crypto'
import { cpSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const outputRoot = resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const allowedRoot = resolve(projectRoot, 'dist/payload')

if (!isWithin(outputRoot, allowedRoot)) throw new Error('Payload output must remain under dist/payload.')
rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })

copy('apps/server/dist')
copy('apps/server/package.json')
copy('apps/web/dist')
copy('agents')
copy('data/catalogue')
copy('scripts/catalogue')
copy('package.json')

for (const workspace of ['contracts', 'copilot', 'elite']) {
  copy(`packages/${workspace}/dist`, `node_modules/@phoenix/${workspace}/dist`)
  copy(`packages/${workspace}/package.json`, `node_modules/@phoenix/${workspace}/package.json`)
}

for (const dependency of productionDependencies()) {
  const relativePath = relative(resolve(projectRoot, 'node_modules'), dependency)
  if (relativePath.startsWith(`@phoenix${sep}`) || relativePath === '@phoenix') continue
  copyAbsolute(dependency, resolve(outputRoot, 'node_modules', relativePath))
}

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

function productionDependencies () {
  const discovered = new Map()
  const visitedWorkspaces = new Set()
  const pending = Object.keys(JSON.parse(readFileSync(resolve(projectRoot, 'apps/server/package.json'), 'utf8')).dependencies ?? {})
  while (pending.length > 0) {
    const name = pending.shift()
    if (name.startsWith('@phoenix/')) {
      if (!visitedWorkspaces.has(name)) {
        visitedWorkspaces.add(name)
        pending.push(...workspaceDependencies(name))
      }
      continue
    }
    if (discovered.has(name)) continue
    const path = resolve(projectRoot, 'node_modules', name)
    if (!existsSync(path)) continue
    const manifest = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'))
    discovered.set(name, path)
    pending.push(...dependencyNames(manifest))
  }
  return [...discovered.values()]
}

function workspaceDependencies (name) {
  const workspace = name.slice('@phoenix/'.length)
  const manifestPath = resolve(projectRoot, 'packages', workspace, 'package.json')
  if (!existsSync(manifestPath)) throw new Error(`Unknown PHOENIX workspace dependency: ${name}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return dependencyNames(manifest)
}

function dependencyNames (manifest) {
  return [...new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {})
  ])]
}

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
