import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import { JsonConversationStore } from '../apps/server/src/infrastructure/json-conversation-store.js'
import { JsonOpenAiSecretRepository } from '../apps/server/src/infrastructure/json-openai-secret-repository.js'
import { JsonSystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { JsonMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { RotatingWireLogger } from '../apps/server/src/infrastructure/rotating-wire-logger.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test.skipIf(process.platform === 'win32')('user-state stores create and correct private POSIX permissions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-private-state-'))
  const settingsFile = join(root, 'settings', 'settings.json')
  const macroFile = join(root, 'macros', 'macros.json')
  const databaseFile = join(root, 'runtime', 'phoenix.sqlite')
  const conversationDirectory = join(root, 'conversations')
  const wireFile = join(root, 'logs', 'openai.ndjson')
  const secretFile = join(root, 'secrets', 'openai.json')
  const pairingFile = join(root, 'pairing', 'credentials.json')
  const database = new SqliteDatabase(databaseFile)

  try {
    new JsonSystemSettingsRepository(settingsFile).loadOrCreate()
    new JsonMacroRepository(macroFile).save({
      assumptions: [],
      description: 'Test macro.',
      enabled: true,
      id: 'test-macro',
      name: 'Test macro',
      risk: 'safe',
      steps: [{ commandId: 'command.elite.ShipSpotLightToggle', operation: 'tap', type: 'command' }],
      version: 2
    })
    database.initialize()
    await new JsonConversationStore(conversationDirectory).create({ id: 'private-conversation' })
    new RotatingWireLogger({ file: wireFile }).write({ type: 'test' })
    new JsonOpenAiSecretRepository(secretFile).save('sk-test-private-state-secret-value')
    new PairingAccessController(pairingFile)

    const files = [settingsFile, macroFile, databaseFile, wireFile, secretFile, pairingFile]
    for (const file of files) expect(mode(file), file).toBe(0o600)
    for (const directory of files.map(dirname).concat(conversationDirectory)) {
      expect(mode(directory), directory).toBe(0o700)
    }
    const conversationFiles = readdirSync(conversationDirectory)
    expect(mode(join(conversationDirectory, conversationFiles[0]!))).toBe(0o600)
    for (const companion of [`${databaseFile}-shm`, `${databaseFile}-wal`]) {
      if (existsSync(companion)) expect(mode(companion), companion).toBe(0o600)
    }

    chmodSync(settingsFile, 0o644)
    chmodSync(dirname(settingsFile), 0o755)
    new JsonSystemSettingsRepository(settingsFile).loadOrCreate()
    expect(mode(settingsFile)).toBe(0o600)
    expect(mode(dirname(settingsFile))).toBe(0o700)
  } finally {
    database.close()
    rmSync(root, { force: true, recursive: true })
  }
})

function mode (path: string): number {
  return statSync(path).mode & 0o777
}
