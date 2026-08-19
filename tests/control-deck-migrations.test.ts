import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { JsonMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { JsonSystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(directory => rmSync(directory, { force: true, recursive: true })))

test('legacy macro action steps migrate atomically to command ids', () => {
  const path = temporaryFile('macros.json')
  writeFileSync(path, JSON.stringify({
    version: 1,
    macros: [{
      assumptions: [], description: '', enabled: true, id: 'lights', name: 'Lights', risk: 'safe', version: 1,
      steps: [{ type: 'game-action', actionId: 'elite.ShipSpotLightToggle', operation: 'tap' }]
    }]
  }))

  expect(new JsonMacroRepository(path).getLibrary()).toMatchObject({
    version: 2,
    macros: [{ version: 2, steps: [{ type: 'command', commandId: 'command.elite.ShipSpotLightToggle', operation: 'tap' }] }]
  })
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ version: 2 })
})

test('invalid legacy macro data is rejected without overwriting the source file', () => {
  const path = temporaryFile('macros.json')
  const source = JSON.stringify({ version: 1, macros: [{ version: 1, id: 'broken', steps: [{ type: 'game-action' }] }] })
  writeFileSync(path, source)

  expect(() => new JsonMacroRepository(path).getLibrary()).toThrow()
  expect(readFileSync(path, 'utf8')).toBe(source)
})

test('version-four layouts and target-based shortcuts migrate together', () => {
  const path = temporaryFile('settings.json')
  writeFileSync(path, JSON.stringify({
    version: 1,
    copilot: { activeProfileId: 'marin', permissions: { gameActions: false, macros: false, dangerousActions: false } },
    controls: {
      backend: 'auto', enabled: true,
      layout: { version: 4, pages: [{ id: 'ship', label: 'Ship', category: 'ship', columns: 8, rows: 5, cells: [{ position: 1, span: 1, target: { type: 'game-action', actionId: 'elite.GalaxyMapOpen' } }] }] }
    },
    modules: {
      numpadCommands: {
        inputAdapter: 'browser', presentation: 'tiles', alwaysConfirm: false, cancelAfterMs: 5000,
        shortcuts: [{ id: 'home', selector: '1', target: { type: 'navigation', destinationId: 'information.home' } }]
      }
    }
  }))

  const settings = new JsonSystemSettingsRepository(path).loadOrCreate()
  expect(settings).toMatchObject({
    version: 2,
    controls: { layout: { version: 5, pages: [{ groupId: 'ship', cells: [{ commandId: 'command.elite.GalaxyMapOpen' }] }] } },
    modules: { numpadCommands: { shortcuts: [{ commandId: 'command.navigation.information.home' }] } }
  })
})

function temporaryFile (name: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-control-deck-migration-'))
  directories.push(directory)
  return join(directory, name)
}
