import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  EliteDataDirectoryLocator,
  EliteStatusFileSource
} from '@phoenix/elite'
import type { EliteGameStatus } from '@phoenix/contracts'

const fixturePath = fileURLToPath(new URL('./fixtures/elite/status-docked.json', import.meta.url))

test('the status source reads, deduplicates and refreshes replaced Status.json files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-status-source-'))
  const statuses: EliteGameStatus[] = []
  cpSync(fixturePath, join(directory, 'Status.json'))
  const source = new EliteStatusFileSource(directory, status => statuses.push(status), {
    pollInterval: 60_000,
    retryDelay: 1
  })

  try {
    await source.start()
    expect(statuses).toHaveLength(1)
    expect(await source.refresh()).toBe(false)

    const replacement = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>
    replacement.timestamp = '2026-08-10T14:02:00Z'
    replacement.Flags = 16777232
    writeFileSync(join(directory, 'Status.json'), JSON.stringify(replacement))

    expect(await source.refresh()).toBe(true)
    expect(statuses).toHaveLength(2)
    expect(statuses[1]?.flags.supercruise).toBe(true)
    expect(source.getDiagnostics()).toMatchObject({
      watching: true,
      fileAvailable: true,
      lastGameTimestamp: '2026-08-10T14:02:00Z',
      error: null
    })
  } finally {
    source.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the directory locator supports explicit paths and common Proton layouts', () => {
  const home = mkdtempSync(join(tmpdir(), 'phoenix-elite-home-'))
  const protonDirectory = join(
    home,
    '.local/share/Steam/steamapps/compatdata/359320/pfx/drive_c/users/steamuser',
    'Saved Games/Frontier Developments/Elite Dangerous'
  )
  mkdirSync(protonDirectory, { recursive: true })

  try {
    expect(new EliteDataDirectoryLocator({
      homeDirectory: home,
      platform: 'linux'
    }).locate()).toBe(protonDirectory)
    expect(new EliteDataDirectoryLocator({
      explicitDirectory: dirname(fixturePath)
    }).locate()).toBe(dirname(fixturePath))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
