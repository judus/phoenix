import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureCertificate, inspectCertificate, prepareCertificate } from '../scripts/experiments/android-tls-certificate.mjs'

const directories = []
function temporary() { const path = mkdtempSync(join(tmpdir(), 'phoenix-tls-test-')); directories.push(path); return path }
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }) })

test('first start creates a private identity, subsequent starts reuse it and renewal is explicit', () => {
  const directory = temporary()
  const first = ensureCertificate(directory, ['127.0.0.1'])
  const bytes = readFileSync(first.cert)
  expect(ensureCertificate(directory, ['127.0.0.1']).fingerprint).toBe(first.fingerprint)
  expect(readFileSync(first.cert)).toEqual(bytes)
  if (process.platform !== 'win32') expect(statSync(first.key).mode & 0o777).toBe(0o600)
  expect(() => prepareCertificate(directory, ['127.0.0.1'])).toThrow('already exists')
  const renewed = prepareCertificate(directory, ['127.0.0.1'], { renew: true })
  expect(renewed.fingerprint).not.toBe(first.fingerprint)
})

test('incomplete, mismatched and expired identities fail without automatic replacement', () => {
  const directory = temporary()
  const identity = ensureCertificate(directory, ['127.0.0.1'])
  const bytes = readFileSync(identity.cert)
  expect(() => inspectCertificate(directory, new Date('2100-01-01'))).toThrow('not currently valid')
  const other = ensureCertificate(temporary(), ['127.0.0.1'])
  writeFileSync(identity.key, readFileSync(other.key))
  expect(() => ensureCertificate(directory, ['127.0.0.1'])).toThrow('do not match')
  expect(readFileSync(identity.cert)).toEqual(bytes)
  unlinkSync(identity.key)
  expect(() => ensureCertificate(directory, ['127.0.0.1'])).toThrow('incomplete')
  expect(readFileSync(identity.cert)).toEqual(bytes)
})

test('certificate preparation validates literal addresses before creating files', () => {
  expect(() => prepareCertificate(join(temporary(), 'not-created'), ['invalid.example'])).toThrow('literal IP')
})
