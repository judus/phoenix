import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const platforms = {
  linux: { name: 'linux-x64', filename: 'PHOENIX-linux-x64.deb', installer: version => `phoenix_${version}_amd64.deb` },
  win32: { name: 'windows-x64', filename: 'PHOENIX-windows-x64-setup.exe', installer: version => `PHOENIX-${version}-windows-x64-setup.exe` }
}
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')

export function stageAssets (root, platform = process.platform, architecture = process.arch) {
  const target = platforms[platform]
  if (!target || architecture !== 'x64') throw new Error('Release installers support Linux/Windows x64 only.')
  const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(resolve(root, `dist/payload/${platform}-x64/manifest.json`), 'utf8'))
  if (manifest.version !== version || manifest.platform !== platform || manifest.architecture !== architecture || manifest.channel !== 'preview') {
    throw new Error('Payload identity or preview channel does not match this release.')
  }
  const output = resolve(root, 'dist/release')
  mkdirSync(output, { recursive: true })
  const destination = resolve(output, target.filename)
  copyFileSync(resolve(root, 'dist/installer', target.installer(version)), destination)
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const metadata = { ...manifest, commit, installer: { filename: target.filename, sha256: hash(destination), bytes: statSync(destination).size } }
  writeFileSync(resolve(output, `PHOENIX-${target.name}-build.json`), `${JSON.stringify(metadata, null, 2)}\n`)
}

export function verifyAssets (directory, version, commit) {
  const files = Object.values(platforms).flatMap(target => [target.filename, `PHOENIX-${target.name}-build.json`]).sort()
  // Do not publish arbitrary files pulled from an artifact archive.
  const actual = readdirSync(directory).filter(name => name !== 'SHA256SUMS').sort()
  if (JSON.stringify(actual) !== JSON.stringify(files)) throw new Error('Expected exactly both installers and their build manifests.')
  for (const [platform, target] of Object.entries(platforms)) {
    const metadata = JSON.parse(readFileSync(resolve(directory, `PHOENIX-${target.name}-build.json`), 'utf8'))
    const installer = resolve(directory, target.filename)
    if (metadata.version !== version || metadata.commit !== commit || metadata.platform !== platform ||
      metadata.architecture !== 'x64' || metadata.channel !== 'preview' || metadata.installer.filename !== target.filename ||
      metadata.installer.bytes !== statSync(installer).size || metadata.installer.sha256 !== hash(installer)) {
      throw new Error(`Release asset identity/checksum mismatch: ${target.name}`)
    }
  }
  writeFileSync(resolve(directory, 'SHA256SUMS'), files.map(name => `${hash(resolve(directory, name))}  ${name}\n`).join(''))
  return [...files, 'SHA256SUMS'].map(name => resolve(directory, name))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'stage') throw new Error('Usage: node scripts/release/assets.mjs stage')
  stageAssets(process.cwd())
}
