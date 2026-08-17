import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { JsonOpenAiSecretRepository } from '../apps/server/src/infrastructure/json-openai-secret-repository.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

test('OpenAI secrets are written atomically with owner-only permissions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-secret-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'nested', 'secrets.json')
  const repository = new JsonOpenAiSecretRepository(path)

  repository.save('sk-test-abcdefghijklmnopqrstuvwxyz')
  expect(repository.get()).toBe('sk-test-abcdefghijklmnopqrstuvwxyz')
  expect(statSync(path).mode & 0o777).toBe(0o600)
  expect(readFileSync(path, 'utf8')).toContain('openAiApiKey')

  repository.remove()
  expect(repository.get()).toBeUndefined()
})
