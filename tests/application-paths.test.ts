import { expect, test } from 'vitest'
import { ApplicationPaths } from '../apps/server/src/infrastructure/application-paths.js'

test('uses repository-local writable roots explicitly in development', () => {
  const paths = ApplicationPaths.development('/workspace/phoenix', {})

  expect(paths.resources.agents).toBe('/workspace/phoenix/agents')
  expect(paths.user.config).toBe('/workspace/phoenix/data')
  expect(paths.user.data).toBe('/workspace/phoenix/data')
  expect(paths.user.logs).toBe('/workspace/phoenix/data/runtime/logs')
})

test('uses XDG roots for a Linux installation', () => {
  const paths = new ApplicationPaths({
    environment: { XDG_DATA_HOME: '/data', XDG_STATE_HOME: '/state' },
    homeDirectory: '/home/cmdr',
    installRoot: '/opt/phoenix',
    platform: 'linux'
  })

  expect(paths.user.config).toBe('/home/cmdr/.config/phoenix')
  expect(paths.user.data).toBe('/data/phoenix')
  expect(paths.user.logs).toBe('/state/phoenix/logs')
})

test('uses LOCALAPPDATA and accepts explicit path overrides on Windows', () => {
  const paths = new ApplicationPaths({
    environment: { LOCALAPPDATA: 'C:\\Users\\Cmdr\\AppData\\Local', PHOENIX_LOGS_PATH: '/shared/logs' },
    homeDirectory: 'C:\\Users\\Cmdr',
    installRoot: '/phoenix',
    platform: 'win32'
  })

  expect(paths.user.data).toMatch(/PHOENIX[\\/]Data$/)
  expect(paths.user.logs).toBe('/shared/logs')
})
