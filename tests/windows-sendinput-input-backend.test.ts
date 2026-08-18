import { expect, test } from 'vitest'
import type { GameActionOperation, LogicalInputChord } from '@phoenix/contracts'
import {
  WindowsSendInputBackend,
  type WindowsInputEvent,
  type WindowsSendInputRunner
} from '../apps/server/src/infrastructure/windows-sendinput-input-backend.js'

test.each([
  ['tap', [
    { virtualKey: 0xa0, flags: 0 },
    { virtualKey: 0xa5, flags: 1 },
    { virtualKey: 0x47, flags: 0 },
    { virtualKey: 0x47, flags: 2 },
    { virtualKey: 0xa5, flags: 3 },
    { virtualKey: 0xa0, flags: 2 }
  ]],
  ['press', [
    { virtualKey: 0xa0, flags: 0 },
    { virtualKey: 0xa5, flags: 1 },
    { virtualKey: 0x47, flags: 0 }
  ]],
  ['release', [
    { virtualKey: 0x47, flags: 2 },
    { virtualKey: 0xa5, flags: 3 },
    { virtualKey: 0xa0, flags: 2 }
  ]]
] as Array<[GameActionOperation, WindowsInputEvent[]]>)('SendInput %s emits ordered native input with a bounded tap hold', async (operation, expected) => {
  const runner = new RecordingSendInputRunner()
  const backend = configuredBackend(runner)

  await backend.send(operation, chord('G', ['LeftShift', 'RightAlt']))

  expect(backend.getStatus()).toMatchObject({
    id: 'windows-sendinput',
    available: true,
    simulated: false
  })
  expect(runner.requests).toEqual([{
    events: expected,
    holdMilliseconds: operation === 'tap' ? 50 : 0
  }])
})

test('SendInput translates Elite numpad, special and function key names', async () => {
  const runner = new RecordingSendInputRunner()
  const backend = configuredBackend(runner)

  await backend.send('tap', chord('Numpad_Divide', ['RightControl']))
  await backend.send('tap', chord('F11'))

  expect(runner.requests).toEqual([
    {
      events: [
        { virtualKey: 0xa3, flags: 1 },
        { virtualKey: 0x6f, flags: 1 },
        { virtualKey: 0x6f, flags: 3 },
        { virtualKey: 0xa3, flags: 3 }
      ],
      holdMilliseconds: 50
    },
    {
      events: [
        { virtualKey: 0x7a, flags: 0 },
        { virtualKey: 0x7a, flags: 2 }
      ],
      holdMilliseconds: 50
    }
  ])
})

test('SendInput rejects unsupported Elite keys before invoking the helper', async () => {
  const runner = new RecordingSendInputRunner()
  const backend = configuredBackend(runner)

  await expect(backend.send('tap', chord('Mouse_1'))).rejects.toThrow('Unsupported Elite keyboard key')
  expect(runner.requests).toEqual([])
})

test('SendInput propagates native helper failures', async () => {
  const backend = configuredBackend({
    run: () => Promise.reject(new Error('SendInput returned zero'))
  })

  await expect(backend.send('tap', chord('L'))).rejects.toThrow('SendInput returned zero')
})

test('SendInput stops its persistent native helper', async () => {
  const runner = new RecordingSendInputRunner()
  const backend = configuredBackend(runner)

  await backend.stop()

  expect(runner.stopped).toBe(true)
})

test('SendInput reports non-Windows, missing helper and non-interactive sessions', () => {
  const nonWindows = new WindowsSendInputBackend({ platform: 'linux' })
  const missing = new WindowsSendInputBackend({
    environment: { SystemRoot: 'C:\\Windows' },
    fileExists: () => false,
    platform: 'win32'
  })
  const service = new WindowsSendInputBackend({
    environment: { SESSIONNAME: 'Services' },
    executablePath: 'powershell.exe',
    fileExists: () => true,
    platform: 'win32'
  })

  expect(nonWindows.getStatus()).toMatchObject({ available: false })
  expect(missing.getStatus().detail).toContain('PowerShell is unavailable')
  expect(service.getStatus().detail).toContain('outside an interactive')
})

class RecordingSendInputRunner implements WindowsSendInputRunner {
  public readonly requests: Array<{
    events: WindowsInputEvent[]
    holdMilliseconds: number
  }> = []
  public stopped = false

  public run (
    _executable: string,
    events: readonly WindowsInputEvent[],
    holdMilliseconds: number
  ): Promise<void> {
    this.requests.push({ events: [...events], holdMilliseconds })
    return Promise.resolve()
  }

  public stop (): void {
    this.stopped = true
  }
}

function configuredBackend (runner: WindowsSendInputRunner): WindowsSendInputBackend {
  return new WindowsSendInputBackend({
    environment: { SESSIONNAME: 'Console' },
    executablePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    fileExists: () => true,
    platform: 'win32',
    runner
  })
}

function chord (key: string, modifiers: string[] = []): LogicalInputChord {
  return { key, modifiers, display: [...modifiers, key].join('+') }
}
