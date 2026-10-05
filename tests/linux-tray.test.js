import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { createLinuxTray } from '../scripts/package/linux-tray.mjs'

test.each([{}, { DBUS_SESSION_BUS_ADDRESS: 'ignored', PHOENIX_DESKTOP_INTEGRATION: 'false' }])('tray is optional in disabled/headless environments', async environment => {
  const factory = vi.fn()
  expect(await createLinuxTray({ actions: {}, iconPath: '', onError: vi.fn(), environment, busFactory: factory })).toBeNull()
  expect(factory).not.toHaveBeenCalled()
})

test('failed desktop setup reports the problem without preventing application startup', async () => {
  const error = vi.fn()
  expect(await createLinuxTray({ actions: {}, iconPath: '', onError: error,
    environment: { DBUS_SESSION_BUS_ADDRESS: 'fixture' }, busFactory: () => { throw new Error('No session bus') } })).toBeNull()
  expect(error).toHaveBeenCalledWith('PHOENIX tray: No session bus')
})

test.skipIf(process.platform !== 'linux')('tray protocol and lifecycle work across a private D-Bus session', () => {
  const output = execFileSync('dbus-run-session', ['--', process.execPath, resolve('tests/fixtures/linux-tray-session.mjs')],
    { encoding: 'utf8', timeout: 15_000 })
  expect(output).toContain('cleanup passed over D-Bus')
})
