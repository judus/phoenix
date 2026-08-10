import { expect, test } from 'vitest'
import type { GameActionOperation, LogicalInputChord } from '@phoenix/contracts'
import {
  LinuxYdotoolInputBackend,
  type ProcessCommandRunner
} from '../apps/server/src/infrastructure/linux-ydotool-input-backend.js'

test.skipIf(process.platform !== 'linux').each([
  ['tap', ['key', '42:1', '100:1', '34:1', '34:0', '100:0', '42:0']],
  ['press', ['key', '42:1', '100:1', '34:1']],
  ['release', ['key', '34:0', '100:0', '42:0']]
] as Array<[GameActionOperation, string[]]>)('ydotool %s emits ordered Linux input events', async (operation, expected) => {
  const runner = new RecordingCommandRunner()
  const backend = configuredBackend(runner)

  await backend.send(operation, chord('G', ['LeftShift', 'RightAlt']))

  expect(backend.getStatus()).toMatchObject({
    id: 'linux-ydotool',
    available: true,
    simulated: false
  })
  expect(runner.commands).toEqual([{
    executable: '/opt/ydotool',
    arguments_: expected,
    socket: '/run/user/1000/.ydotool_socket'
  }])
})

test.skipIf(process.platform !== 'linux')('ydotool rejects unsupported Elite keys before invoking the process', async () => {
  const runner = new RecordingCommandRunner()
  const backend = configuredBackend(runner)

  await expect(backend.send('tap', chord('ImaginaryKey'))).rejects.toThrow('Unsupported Elite keyboard key')
  expect(runner.commands).toEqual([])
})

test.skipIf(process.platform !== 'linux')('ydotool propagates command failures through the input backend', async () => {
  const backend = configuredBackend({
    run: () => Promise.reject(new Error('socket disconnected'))
  })

  await expect(backend.send('tap', chord('L'))).rejects.toThrow('socket disconnected')
})

test.skipIf(process.platform !== 'linux')('ydotool reports missing and obsolete installations without sending input', () => {
  const missing = new LinuxYdotoolInputBackend({
    executablePath: '/missing/ydotool',
    fileExists: () => false,
    versionProbe: () => null
  })
  const obsolete = new LinuxYdotoolInputBackend({
    executablePath: '/usr/bin/ydotool',
    socketPath: '/tmp/.ydotool_socket',
    fileExists: () => true,
    versionProbe: () => '0.1.8'
  })

  expect(missing.getStatus()).toMatchObject({ available: false })
  expect(missing.getStatus().detail).toContain('not installed')
  expect(obsolete.getStatus()).toMatchObject({ available: false })
  expect(obsolete.getStatus().detail).toContain('1.x is required')
})

test.skipIf(process.platform !== 'linux')('ydotool notices a daemon socket that appears after startup', () => {
  let socketAvailable = false
  const backend = new LinuxYdotoolInputBackend({
    environment: { PATH: '/opt', YDOTOOL_SOCKET: '/run/user/1000/.ydotool_socket' },
    executablePath: '/opt/ydotool',
    fileExists: path => path === '/opt/ydotool' || socketAvailable,
    versionProbe: () => '1.0.4'
  })

  expect(backend.getStatus()).toMatchObject({ available: false })
  socketAvailable = true
  expect(backend.getStatus()).toMatchObject({ available: true })
})

class RecordingCommandRunner implements ProcessCommandRunner {
  public readonly commands: Array<{ executable: string, arguments_: string[], socket: string | undefined }> = []

  public run (executable: string, arguments_: string[], environment: NodeJS.ProcessEnv): Promise<void> {
    this.commands.push({ executable, arguments_, socket: environment.YDOTOOL_SOCKET })
    return Promise.resolve()
  }
}

function configuredBackend (runner: ProcessCommandRunner): LinuxYdotoolInputBackend {
  return new LinuxYdotoolInputBackend({
    environment: { PATH: '/opt' },
    executablePath: '/opt/ydotool',
    socketPath: '/run/user/1000/.ydotool_socket',
    fileExists: () => true,
    runner,
    versionProbe: () => '1.0.4'
  })
}

function chord (key: string, modifiers: string[] = []): LogicalInputChord {
  return { key, modifiers, display: [...modifiers, key].join('+') }
}
