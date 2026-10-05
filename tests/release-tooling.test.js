import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { validateTag } from '../scripts/release/check-tag.mjs'
import { stageAssets, verifyAssets } from '../scripts/release/assets.mjs'

let root
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const write = (path, value) => {
  const file = resolve(root, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
}
beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'phoenix-release-test-'))
  git('init', '-b', 'main')
  write('package.json', { version: '0.1.3' })
  write('package-lock.json', { version: '0.1.3', packages: { '': { version: '0.1.3' } } })
  git('add', 'package.json', 'package-lock.json')
  git('-c', 'user.name=Release Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('tag', 'v0.1.3')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('release tag eligibility', () => {
  test('accepts an existing matching version tag on main', () => {
    expect(validateTag(root, 'v0.1.3')).toEqual({ tag: 'v0.1.3', version: '0.1.3', commit: git('rev-parse', 'HEAD') })
  })
  test.each(['main', '../main', 'v0.1.4', 'v0.1.3;echo unsafe', 'v0.1.3-preview.1', undefined])('rejects invalid or mismatched tag %s', tag => {
    expect(() => validateTag(root, tag)).toThrow('Release tag must')
  })
  test('rejects inconsistent lockfile versions', () => {
    write('package-lock.json', { version: '0.1.3', packages: { '': { version: '0.1.2' } } })
    expect(() => validateTag(root, 'v0.1.3')).toThrow('lock version')
  })
  test('rejects a missing tag instead of creating one', () => {
    git('tag', '-d', 'v0.1.3')
    expect(() => validateTag(root, 'v0.1.3')).toThrow()
  })
  test('rejects a different checkout and a tag outside main', () => {
    write('new.txt', 'unreleased')
    git('add', 'new.txt')
    git('-c', 'user.name=Release Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Unreleased')
    expect(() => validateTag(root, 'v0.1.3')).toThrow('Checkout does not match')
    git('tag', '-f', 'v0.1.3')
    expect(() => validateTag(root, 'v0.1.3')).toThrow()
  })
})

function installers () {
  for (const platform of ['linux', 'win32']) {
    write(`dist/payload/${platform}-x64/manifest.json`, {
      application: 'PHOENIX', version: '0.1.3', platform, architecture: 'x64', channel: 'preview', node: 'v24.14.0', files: {}
    })
  }
  write('dist/installer/PHOENIX-0.1.3-x86_64.AppImage', 'synthetic linux installer')
  const payloadHash = createHash('sha256').update(readFileSync(resolve(root, 'dist/payload/linux-x64/manifest.json'))).digest('hex')
  write('dist/installer/PHOENIX-0.1.3-x86_64.AppImage.json', {
    version: '0.1.3', channel: 'preview', architecture: 'x64', files: { 'usr/lib/phoenix/manifest.json': payloadHash }
  })
  write('dist/installer/PHOENIX-0.1.3-windows-x64-setup.exe', 'synthetic windows installer')
  stageAssets(root, 'linux', 'x64')
  stageAssets(root, 'win32', 'x64')
  return resolve(root, 'dist/release')
}

describe('release asset staging and verification', () => {
  test('stages stable download names with exact source identity and checksums', () => {
    const directory = installers()
    const files = verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))
    expect(files).toHaveLength(5)
    expect(files).toContain(resolve(directory, 'PHOENIX-linux-x64.AppImage'))
    expect(JSON.parse(readFileSync(resolve(directory, 'PHOENIX-linux-x64-build.json'), 'utf8')).packaging.version).toBe('0.1.3')
    expect(readFileSync(resolve(directory, 'SHA256SUMS'), 'utf8')).toMatch(/^[a-f0-9]{64}  PHOENIX-linux-x64-build.json/m)
    expect(verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))).toEqual(files)
  })
  test('requires both platforms', () => {
    const directory = installers()
    rmSync(resolve(directory, 'PHOENIX-windows-x64-setup.exe'))
    expect(() => verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))).toThrow('exactly both')
  })
  test('rejects unexpected files instead of publishing them', () => {
    const directory = installers()
    write('dist/release/secret.txt', 'must not upload')
    expect(() => verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))).toThrow('exactly both')
  })
  test('rejects modified installers, wrong versions and wrong commits', () => {
    const directory = installers()
    expect(() => verifyAssets(directory, '0.1.4', git('rev-parse', 'HEAD'))).toThrow('mismatch')
    expect(() => verifyAssets(directory, '0.1.3', '0'.repeat(40))).toThrow('mismatch')
    write('dist/release/PHOENIX-linux-x64.AppImage', 'tampered')
    expect(() => verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))).toThrow('mismatch')
  })
  test('rejects unsupported platforms and non-preview payloads', () => {
    installers()
    expect(() => stageAssets(root, 'darwin', 'x64')).toThrow('Linux/Windows')
    expect(() => stageAssets(root, 'linux', 'arm64')).toThrow('Linux/Windows')
    write('dist/payload/linux-x64/manifest.json', { version: '0.1.3', platform: 'linux', architecture: 'x64', channel: 'development' })
    expect(() => stageAssets(root, 'linux', 'x64')).toThrow('preview channel')
  })
  test('rejects an AppImage built from an older payload at the same version', () => {
    installers()
    const path = resolve(root, 'dist/payload/linux-x64/manifest.json')
    const payload = JSON.parse(readFileSync(path, 'utf8'))
    write('dist/payload/linux-x64/manifest.json', { ...payload, files: { 'changed.js': 'new hash' } })
    expect(() => stageAssets(root, 'linux', 'x64')).toThrow('packaging metadata')
  })
  test('rejects a Linux release manifest missing its packaging provenance', () => {
    const directory = installers()
    const path = resolve(directory, 'PHOENIX-linux-x64-build.json')
    const metadata = JSON.parse(readFileSync(path, 'utf8'))
    delete metadata.packaging
    write('dist/release/PHOENIX-linux-x64-build.json', metadata)
    expect(() => verifyAssets(directory, '0.1.3', git('rev-parse', 'HEAD'))).toThrow('packaging identity')
  })
})
