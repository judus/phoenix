import { expect, test } from 'vitest'
import type { GameActionOperation, LogicalInputChord } from '@phoenix/contracts'
import {
  LinuxXdotoolInputBackend,
  type XdotoolCommandRunner
} from '../apps/server/src/infrastructure/linux-xdotool-input-backend.js'

test.skipIf(process.platform !== 'linux').each([
  ['tap', [
    ['keydown', 'shift'],
    ['keydown', 'alt'],
    ['keydown', 'g'],
    ['keyup', 'g'],
    ['keyup', 'alt'],
    ['keyup', 'shift']
  ]],
  ['press', [
    ['keydown', 'shift'],
    ['keydown', 'alt'],
    ['keydown', 'g']
  ]],
  ['release', [
    ['keyup', 'g'],
    ['keyup', 'alt'],
    ['keyup', 'shift']
  ]]
] as Array<[GameActionOperation, string[][]]>)('xdotool %s emits ordered key commands', async (operation, expected) => {
  const runner = new RecordingCommandRunner()
  const backend = configuredBackend(runner)

  await backend.send(operation, chord('G', ['LeftShift', 'RightAlt']))

  expect(backend.getStatus()).toMatchObject({
    id: 'linux-xdotool',
    available: true,
    simulated: false
  })
  expect(runner.commands).toEqual(expected.map(arguments_ => ({
    executable: '/usr/bin/xdotool',
    arguments_,
    display: ':0'
  })))
})

test.skipIf(process.platform !== 'linux')('xdotool translates Elite numpad and special key names', async () => {
  const runner = new RecordingCommandRunner()
  const backend = configuredBackend(runner)

  await backend.send('tap', chord('Numpad_Add', ['LeftControl']))

  expect(runner.commands.map(command => command.arguments_)).toEqual([
    ['keydown', 'ctrl'],
    ['keydown', 'KP_Add'],
    ['keyup', 'KP_Add'],
    ['keyup', 'ctrl']
  ])
})

test.skipIf(process.platform !== 'linux')('xdotool rejects unsafe Elite keys before invoking the process', async () => {
  const runner = new RecordingCommandRunner()
  const backend = configuredBackend(runner)

  await expect(backend.send('tap', chord('bad;key'))).rejects.toThrow('Unsafe keyboard binding')
  expect(runner.commands).toEqual([])
})

test.skipIf(process.platform !== 'linux')('xdotool propagates command failures through the input backend', async () => {
  const backend = configuredBackend({
    run: () => Promise.reject(new Error('X11 connection failed'))
  })

  await expect(backend.send('tap', chord('L'))).rejects.toThrow('X11 connection failed')
})

test.skipIf(process.platform !== 'linux')('xdotool releases keys pressed before a chord command fails', async () => {
  const runner = new FailingCommandRunner(2)
  const backend = configuredBackend(runner)

  await expect(backend.send('tap', chord('G', ['LeftShift', 'RightAlt']))).rejects.toThrow('injected failure')

  expect(runner.commands).toEqual([
    ['keydown', 'shift'],
    ['keydown', 'alt'],
    ['keyup', 'shift']
  ])
  expect(runner.signals[2]).not.toBe(runner.signals[1])
  expect(runner.signals[2]?.aborted).toBe(false)
})

test.skipIf(process.platform !== 'linux')('xdotool releases partial input after caller cancellation', async () => {
  const controller = new AbortController()
  const runner = new RecordingCommandRunner(() => controller.abort())
  const backend = configuredBackend(runner)

  await expect(backend.send('tap', chord('G', ['LeftShift']), controller.signal)).rejects.toThrow('aborted')

  expect(runner.commands.map(command => command.arguments_)).toEqual([
    ['keydown', 'shift'],
    ['keyup', 'shift']
  ])
})

test.skipIf(process.platform !== 'linux')('xdotool serializes concurrent chords', async () => {
  const runner = new DelayedCommandRunner()
  const backend = configuredBackend(runner)

  await Promise.all([
    backend.send('tap', chord('L')),
    backend.send('tap', chord('G'))
  ])

  expect(runner.maximumConcurrency).toBe(1)
  expect(runner.commands).toEqual([
    ['keydown', 'l'],
    ['keyup', 'l'],
    ['keydown', 'g'],
    ['keyup', 'g']
  ])
})

test.skipIf(process.platform !== 'linux')('xdotool reports missing executables and displays', () => {
  const missing = new LinuxXdotoolInputBackend({
    environment: { PATH: '/missing', DISPLAY: ':0' },
    fileIsExecutable: () => false
  })
  const headless = new LinuxXdotoolInputBackend({
    environment: { PATH: '/usr/bin' },
    executablePath: '/usr/bin/xdotool',
    fileIsExecutable: () => true
  })

  expect(missing.getStatus().detail).toContain('not installed')
  expect(missing.getStatus()).toMatchObject({ available: false })
  expect(headless.getStatus().detail).toContain('No X11 display')
  expect(headless.getStatus()).toMatchObject({ available: false })
})

class RecordingCommandRunner implements XdotoolCommandRunner {
  public readonly commands: Array<{
    executable: string
    arguments_: string[]
    display: string | undefined
  }> = []

  public constructor (private readonly afterFirstCommand?: () => void) {}

  public run (executable: string, arguments_: string[], environment: NodeJS.ProcessEnv): Promise<void> {
    this.commands.push({ executable, arguments_, display: environment.DISPLAY })
    if (this.commands.length === 1) this.afterFirstCommand?.()
    return Promise.resolve()
  }
}

class FailingCommandRunner implements XdotoolCommandRunner {
  public readonly commands: string[][] = []
  public readonly signals: Array<AbortSignal | undefined> = []

  public constructor (private readonly failureCall: number) {}

  public run (_executable: string, arguments_: string[], _environment: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<void> {
    this.commands.push(arguments_)
    this.signals.push(signal)
    return this.commands.length === this.failureCall
      ? Promise.reject(new Error('injected failure'))
      : Promise.resolve()
  }
}

class DelayedCommandRunner implements XdotoolCommandRunner {
  public readonly commands: string[][] = []
  public maximumConcurrency = 0
  private active = 0

  public async run (_executable: string, arguments_: string[]): Promise<void> {
    this.active++
    this.maximumConcurrency = Math.max(this.maximumConcurrency, this.active)
    this.commands.push(arguments_)
    await new Promise(resolve => setTimeout(resolve, 1))
    this.active--
  }
}

function configuredBackend (runner: XdotoolCommandRunner): LinuxXdotoolInputBackend {
  return new LinuxXdotoolInputBackend({
    environment: { PATH: '/usr/bin', DISPLAY: ':0' },
    executablePath: '/usr/bin/xdotool',
    fileIsExecutable: () => true,
    runner
  })
}

function chord (key: string, modifiers: string[] = []): LogicalInputChord {
  return { key, modifiers, display: [...modifiers, key].join('+') }
}
