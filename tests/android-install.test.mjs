import { describe, expect, test, vi } from 'vitest'
import { installAndroid, parseDevices, parseOptions, wirelessAddress } from '../scripts/android/install.mjs'

const listing = (...rows) => `List of devices attached\n${rows.join('\n')}\n`
const tablet = 'tablet-1 device product:test model:Test_Tablet transport_id:1'
const emulator = 'emulator-5580 device model:Android_Emulator transport_id:2'

function harness(lists, answers = []) {
  const run = vi.fn(async (_command, args) => args[0] === 'devices' ? lists.shift() : 'Success\n')
  return { run, ask: vi.fn(async () => answers.shift()), log: vi.fn(), hasApk: () => true, platform: 'linux' }
}

describe('Android debug installer', () => {
  test('parses only adb device rows, retaining unavailable states and model labels', () => {
    expect(parseDevices(`* daemon started successfully *\n${listing(tablet, 'usb-2 unauthorized', 'wireless-3 offline')}`)).toEqual([
      { serial: 'tablet-1', state: 'device', model: 'Test Tablet' },
      { serial: 'usb-2', state: 'unauthorized', model: undefined },
      { serial: 'wireless-3', state: 'offline', model: undefined }
    ])
  })

  test('builds, installs with data preserved and launches the only ready device', async () => {
    const io = harness([listing(tablet, 'other unauthorized')])
    await installAndroid({ build: true }, io)
    expect(io.ask).not.toHaveBeenCalled()
    expect(io.run.mock.calls.map(([, args]) => args.slice(0, 4))).toEqual([
      ['devices', '-l'], ['assembleDebug'], ['-s', 'tablet-1', 'install', '-r'], ['-s', 'tablet-1', 'shell', 'am']
    ])
    expect(io.run.mock.calls[1][0]).toBe('./gradlew')
    expect(io.run.mock.calls[3][1]).toContain('io.github.judus.phoenix.debug/io.github.judus.phoenix.MainActivity')
  })

  test('asks which device, never silently installs on all devices', async () => {
    const io = harness([listing(tablet, emulator)], ['2'])
    await installAndroid({ build: false }, io)
    expect(io.run.mock.calls[1][1].slice(0, 4)).toEqual(['-s', 'emulator-5580', 'install', '-r'])
    expect(io.run).toHaveBeenCalledTimes(3)
  })

  test('explicit serial bypasses selection but must identify a ready device', async () => {
    const io = harness([listing(tablet, emulator)])
    await installAndroid({ build: false, serial: 'tablet-1' }, io)
    expect(io.ask).not.toHaveBeenCalled()
    const unavailable = harness([listing('tablet-1 unauthorized', emulator)])
    await expect(installAndroid({ build: true, serial: 'tablet-1' }, unavailable)).rejects.toThrow('not ready')
    expect(unavailable.run).toHaveBeenCalledTimes(1)
  })

  test('pairs interactively without collecting a code, then uses the separate connection port', async () => {
    const io = harness([listing(), listing(), listing('192.0.2.1:37000 device')], ['1', '192.0.2.1:46000', '192.0.2.1:37000'])
    await installAndroid({ build: false }, io)
    expect(io.run).toHaveBeenCalledWith('adb', ['pair', '192.0.2.1:46000'], { interactive: true })
    expect(io.run).toHaveBeenCalledWith('adb', ['connect', '192.0.2.1:37000'])
    expect(io.run.mock.calls.at(-2)[1].slice(0, 4)).toEqual(['-s', '192.0.2.1:37000', 'install', '-r'])
    expect(io.ask).toHaveBeenCalledTimes(3) // mode + two endpoints, not a pairing-code prompt
  })

  test('uses automatic discovery after pairing without requesting another port', async () => {
    const io = harness([listing(), listing(tablet)], ['1', '192.0.2.1:46000'])
    await installAndroid({ build: false }, io)
    expect(io.ask).toHaveBeenCalledTimes(2)
    expect(io.run.mock.calls.some(([, args]) => args[0] === 'connect')).toBe(false)
  })

  test('connects an already paired device without pairing again', async () => {
    const io = harness([listing(), listing('192.0.2.1:37000 device')], ['2', '192.0.2.1:37000'])
    await installAndroid({ build: false }, io)
    expect(io.run.mock.calls.some(([, args]) => args[0] === 'pair')).toBe(false)
  })

  test('failed connection never falls back to a different device that appeared meanwhile', async () => {
    const io = harness([listing(), listing(emulator)], ['2', '192.0.2.1:37000'])
    await expect(installAndroid({ build: false }, io)).rejects.toThrow('did not connect')
    expect(io.run.mock.calls.some(([, args]) => args.includes('install'))).toBe(false)
  })

  test.each(['build', 'install'])('stops on %s failure without uninstalling or launching', async failure => {
    const io = harness([listing(tablet)])
    io.run.mockImplementation(async (_command, args) => {
      if (args[0] === 'devices') return listing(tablet)
      if (failure === 'build' || args.includes('install')) throw new Error('Failed deliberately')
      return ''
    })
    await expect(installAndroid({ build: true }, io)).rejects.toThrow('Failed deliberately')
    expect(io.run.mock.calls.some(([, args]) => args.includes('uninstall') || args.includes('start'))).toBe(false)
  })

  test('missing existing APK does not touch the selected device', async () => {
    const io = { ...harness([listing(tablet)]), hasApk: () => false }
    await expect(installAndroid({ build: false }, io)).rejects.toThrow('without --no-build')
    expect(io.run).toHaveBeenCalledTimes(1)
  })

  test('Windows builds with its wrapper and keeps adb arguments outside a shell', async () => {
    const io = { ...harness([listing(tablet)]), platform: 'win32' }
    await installAndroid({ build: true }, io)
    expect(io.run.mock.calls[1]).toEqual(['gradlew.bat', ['assembleDebug'], expect.objectContaining({ shell: true })])
    expect(io.run.mock.calls[2]).toHaveLength(2)
  })

  test('validates CLI options and wireless endpoints before passing them to adb', () => {
    expect(parseOptions(['--serial', 'emulator-5580', '--no-build'])).toMatchObject({ serial: 'emulator-5580', build: false })
    expect(parseOptions(['--help']).help).toBe(true)
    expect(() => parseOptions(['--serial'])).toThrow('Usage')
    expect(() => parseOptions(['--force'])).toThrow('Usage')
    expect(wirelessAddress(' [fd00::1]:37000 ')).toBe('[fd00::1]:37000')
    for (const endpoint of ['--help', 'host', 'host:0', 'host:65536', 'host:abc', 'host:123;evil']) {
      expect(() => wirelessAddress(endpoint)).toThrow('IP address and port')
    }
  })
})
