import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { createInterface, type Interface as ReadlineInterface } from 'node:readline'
import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'

export interface WindowsInputEvent {
  flags: number
  virtualKey: number
}

export interface WindowsSendInputRunner {
  run(
    executable: string,
    events: readonly WindowsInputEvent[],
    holdMilliseconds: number,
    environment: NodeJS.ProcessEnv,
    signal?: AbortSignal
  ): Promise<void>
  stop?(): Promise<void> | void
}

export interface WindowsSendInputBackendOptions {
  environment?: NodeJS.ProcessEnv
  executablePath?: string
  fileExists?: (path: string) => boolean
  platform?: NodeJS.Platform
  runner?: WindowsSendInputRunner
}

export class WindowsSendInputBackend implements InputBackend {
  private readonly environment: NodeJS.ProcessEnv
  private readonly executablePath: string | null
  private readonly fileExists: (path: string) => boolean
  private readonly platform: NodeJS.Platform
  private readonly runner: WindowsSendInputRunner

  public constructor (options: WindowsSendInputBackendOptions = {}) {
    this.environment = options.environment ?? process.env
    this.fileExists = options.fileExists ?? existsSync
    this.platform = options.platform ?? process.platform
    this.executablePath = options.executablePath ?? findPowerShell(this.environment, this.fileExists)
    this.runner = options.runner ?? new PersistentPowerShellWindowsSendInputRunner()
  }

  public getStatus (): InputBackendStatus {
    if (this.platform !== 'win32') return unavailable('The SendInput backend is available only on Windows.')
    if (!this.executablePath || !this.fileExists(this.executablePath)) {
      return unavailable('Windows PowerShell is unavailable; PHOENIX cannot start its SendInput helper.')
    }
    if (this.environment.SESSIONNAME?.toLowerCase() === 'services') {
      return unavailable('PHOENIX is running outside an interactive Windows desktop session.')
    }
    return {
      id: 'windows-sendinput',
      available: true,
      simulated: false,
      detail: 'Windows SendInput is ready for the active desktop session.'
    }
  }

  public async send (operation: GameActionOperation, binding: LogicalInputChord, signal?: AbortSignal): Promise<void> {
    const status = this.getStatus()
    if (!status.available || !this.executablePath) throw new Error(status.detail)
    signal?.throwIfAborted()
    await this.runner.run(
      this.executablePath,
      windowsInputEvents(operation, binding),
      operation === 'tap' ? WINDOWS_TAP_HOLD_MILLISECONDS : 0,
      this.environment,
      signal
    )
  }

  public async stop (): Promise<void> {
    await this.runner.stop?.()
  }
}

interface PendingSendInputRequest {
  reject: (cause: Error) => void
  resolve: () => void
  timeout: NodeJS.Timeout
}

export class PersistentPowerShellWindowsSendInputRunner implements WindowsSendInputRunner {
  private commandQueue: Promise<void> = Promise.resolve()
  private lineReader: ReadlineInterface | null = null
  private pendingRequest: PendingSendInputRequest | null = null
  private process: ChildProcessWithoutNullStreams | null = null
  private startPromise: Promise<void> | null = null
  private stderr = ''

  public run (
    executable: string,
    events: readonly WindowsInputEvent[],
    holdMilliseconds: number,
    environment: NodeJS.ProcessEnv,
    signal?: AbortSignal
  ): Promise<void> {
    const serializedEvents = events.map(event => `${event.virtualKey}:${event.flags}`).join(',')
    const task = this.commandQueue.then(async () => {
      signal?.throwIfAborted()
      const child = await this.ensureStarted(executable, environment)
      signal?.throwIfAborted()
      await this.sendRequest(child, `${holdMilliseconds};${serializedEvents}`, signal)
    })
    this.commandQueue = task.catch(() => {})
    return task
  }

  public async stop (): Promise<void> {
    await this.commandQueue.catch(() => {})
    const child = this.process
    if (!child) return
    this.resetProcess(child, new Error('Windows SendInput helper stopped.'))
    child.stdin.end()
    child.kill()
  }

  private ensureStarted (
    executable: string,
    environment: NodeJS.ProcessEnv
  ): Promise<ChildProcessWithoutNullStreams> {
    if (this.process && this.startPromise) {
      return this.startPromise.then(() => this.process as ChildProcessWithoutNullStreams)
    }

    const child = spawn(executable, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        POWERSHELL_SENDINPUT_COMMAND
      ], {
        env: environment,
        stdio: 'pipe',
        windowsHide: true
      })
    this.process = child
    this.stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-4_096)
    })
    this.lineReader = createInterface({ input: child.stdout })

    this.startPromise = new Promise<void>((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error('Windows SendInput helper timed out during startup.')
        this.resetProcess(child, error)
        child.kill()
        reject(error)
      }, 10_000)

      const onLine = (line: string): void => {
        if (line === 'READY') {
          clearTimeout(timeout)
          resolvePromise()
          return
        }
        this.handleResponse(line)
      }
      this.lineReader?.on('line', onLine)
      child.once('error', cause => {
        clearTimeout(timeout)
        const error = new Error(`Windows SendInput helper failed: ${cause.message}`)
        this.resetProcess(child, error)
        reject(error)
      })
      child.once('exit', (code, processSignal) => {
        clearTimeout(timeout)
        const detail = this.stderr.trim()
        const outcome = code === null ? `signal ${processSignal ?? 'unknown'}` : `code ${code}`
        const error = new Error(`Windows SendInput helper exited with ${outcome}${detail ? `: ${detail}` : '.'}`)
        this.resetProcess(child, error)
        reject(error)
      })
    })

    return this.startPromise.then(() => child)
  }

  private async sendRequest (
    child: ChildProcessWithoutNullStreams,
    request: string,
    signal?: AbortSignal
  ): Promise<void> {
    await new Promise<void>((resolvePromise, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error('Windows SendInput helper timed out while sending input.')
        this.resetProcess(child, error)
        child.kill()
        reject(error)
      }, 5_000)
      const onAbort = (): void => {
        const error = signal?.reason instanceof Error ? signal.reason : new Error('Windows SendInput was aborted.')
        this.resetProcess(child, error)
        child.kill()
        reject(error)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      this.pendingRequest = {
        reject: cause => {
          signal?.removeEventListener('abort', onAbort)
          reject(cause)
        },
        resolve: () => {
          signal?.removeEventListener('abort', onAbort)
          resolvePromise()
        },
        timeout
      }
      child.stdin.write(`${request}\n`, error => {
        if (!error) return
        const failure = new Error(`Windows SendInput helper write failed: ${error.message}`)
        this.resetProcess(child, failure)
        child.kill()
        reject(failure)
      })
    })
  }

  private handleResponse (line: string): void {
    const pending = this.pendingRequest
    if (!pending) return
    this.pendingRequest = null
    clearTimeout(pending.timeout)
    if (line === 'OK') {
      pending.resolve()
      return
    }
    if (line.startsWith('ERROR:')) {
      const detail = Buffer.from(line.slice('ERROR:'.length), 'base64').toString('utf8')
      pending.reject(new Error(`Windows SendInput failed: ${detail}`))
      return
    }
    pending.reject(new Error(`Windows SendInput helper returned an unexpected response: ${line}`))
  }

  private resetProcess (child: ChildProcessWithoutNullStreams, cause: Error): void {
    if (this.process !== child) return
    this.process = null
    this.startPromise = null
    this.lineReader?.close()
    this.lineReader = null
    const pending = this.pendingRequest
    this.pendingRequest = null
    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(cause)
    }
  }
}

const WINDOWS_TAP_HOLD_MILLISECONDS = 50

function windowsInputEvents (operation: GameActionOperation, binding: LogicalInputChord): WindowsInputEvent[] {
  const keys = [
    ...binding.modifiers.map(eliteKeyToVirtualKey),
    eliteKeyToVirtualKey(binding.key)
  ]
  if (keys.length > 4) throw new Error(`Unsupported key combination: ${binding.display}.`)

  const down = keys.map(key => inputEvent(key, false))
  const up = [...keys].reverse().map(key => inputEvent(key, true))
  if (operation === 'press') return down
  if (operation === 'release') return up
  return [...down, ...up]
}

function inputEvent (key: VirtualKey, keyUp: boolean): WindowsInputEvent {
  return {
    flags: (key.extended ? 0x0001 : 0) | (keyUp ? 0x0002 : 0),
    virtualKey: key.code
  }
}

interface VirtualKey {
  code: number
  extended?: boolean
}

function eliteKeyToVirtualKey (key: string): VirtualKey {
  if (/^[a-z]$/iu.test(key)) return { code: key.toUpperCase().charCodeAt(0) }
  if (/^[0-9]$/u.test(key)) return { code: key.charCodeAt(0) }
  const functionKey = /^F([1-9]|1[0-9]|2[0-4])$/u.exec(key)
  if (functionKey) return { code: 0x70 + Number.parseInt(functionKey[1]!, 10) - 1 }
  const translated = WINDOWS_VIRTUAL_KEYS[key]
  if (translated) return translated
  throw new Error(`Unsupported Elite keyboard key: ${key}.`)
}

const WINDOWS_VIRTUAL_KEYS: Readonly<Record<string, VirtualKey>> = {
  BackSlash: { code: 0xdc },
  BackSpace: { code: 0x08 },
  Comma: { code: 0xbc },
  Delete: { code: 0x2e, extended: true },
  DownArrow: { code: 0x28, extended: true },
  End: { code: 0x23, extended: true },
  Enter: { code: 0x0d },
  Equals: { code: 0xbb },
  Escape: { code: 0x1b },
  ForwardSlash: { code: 0xbf },
  Home: { code: 0x24, extended: true },
  Insert: { code: 0x2d, extended: true },
  LeftAlt: { code: 0xa4 },
  LeftArrow: { code: 0x25, extended: true },
  LeftControl: { code: 0xa2 },
  LeftShift: { code: 0xa0 },
  Minus: { code: 0xbd },
  Numpad_0: { code: 0x60 },
  Numpad_1: { code: 0x61 },
  Numpad_2: { code: 0x62 },
  Numpad_3: { code: 0x63 },
  Numpad_4: { code: 0x64 },
  Numpad_5: { code: 0x65 },
  Numpad_6: { code: 0x66 },
  Numpad_7: { code: 0x67 },
  Numpad_8: { code: 0x68 },
  Numpad_9: { code: 0x69 },
  Numpad_Add: { code: 0x6b },
  Numpad_Decimal: { code: 0x6e },
  Numpad_Divide: { code: 0x6f, extended: true },
  Numpad_Enter: { code: 0x0d, extended: true },
  Numpad_Multiply: { code: 0x6a },
  Numpad_Subtract: { code: 0x6d },
  PageDown: { code: 0x22, extended: true },
  PageUp: { code: 0x21, extended: true },
  Period: { code: 0xbe },
  RightAlt: { code: 0xa5, extended: true },
  RightArrow: { code: 0x27, extended: true },
  RightControl: { code: 0xa3, extended: true },
  RightShift: { code: 0xa1 },
  Space: { code: 0x20 },
  Tab: { code: 0x09 },
  UpArrow: { code: 0x26, extended: true }
}

function findPowerShell (
  environment: NodeJS.ProcessEnv,
  fileExists: (path: string) => boolean
): string | null {
  if (environment.SystemRoot) {
    const systemPowerShell = join(
      environment.SystemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    )
    if (fileExists(systemPowerShell)) return systemPowerShell
  }
  for (const directory of (environment.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(directory, 'powershell.exe')
    if (fileExists(candidate)) return candidate
  }
  return null
}

function unavailable (detail: string): InputBackendStatus {
  return {
    id: 'windows-sendinput',
    available: false,
    simulated: false,
    detail
  }
}

const POWERSHELL_SENDINPUT_SCRIPT = String.raw`
$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class PhoenixSendInput {
    private const uint InputKeyboard = 1;
    private const uint KeyEventScanCode = 0x0008;
    private const uint MapVirtualKeyToScanCodeExtended = 4;

    [StructLayout(LayoutKind.Sequential)]
    private struct Input {
        public uint type;
        public InputUnion data;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion {
        [FieldOffset(0)] public MouseInput mouse;
        [FieldOffset(0)] public KeyboardInput keyboard;
        [FieldOffset(0)] public HardwareInput hardware;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardInput {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HardwareInput {
        public uint message;
        public ushort parameterLow;
        public ushort parameterHigh;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, Input[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern uint MapVirtualKey(uint code, uint mapType);

    public static void Send(ushort[] virtualKeys, uint[] flags, int holdMilliseconds) {
        if (virtualKeys.Length != flags.Length) throw new ArgumentException("Mismatched input arrays.");
        var firstRelease = Array.FindIndex(flags, flag => (flag & 0x0002) != 0);
        if (holdMilliseconds > 0 && firstRelease > 0) {
            SendRange(virtualKeys, flags, 0, firstRelease);
            System.Threading.Thread.Sleep(holdMilliseconds);
            SendRange(virtualKeys, flags, firstRelease, virtualKeys.Length - firstRelease);
            return;
        }
        SendRange(virtualKeys, flags, 0, virtualKeys.Length);
    }

    private static void SendRange(ushort[] virtualKeys, uint[] flags, int offset, int count) {
        var inputs = new Input[count];
        for (var index = 0; index < count; index++) {
            var sourceIndex = offset + index;
            var scanCode = MapVirtualKey(virtualKeys[sourceIndex], MapVirtualKeyToScanCodeExtended);
            if (scanCode == 0) throw new Win32Exception("Windows could not map a virtual key to a hardware scan code.");
            inputs[index].type = InputKeyboard;
            inputs[index].data.keyboard.virtualKey = 0;
            inputs[index].data.keyboard.scanCode = (ushort)(scanCode & 0xff);
            inputs[index].data.keyboard.flags = flags[sourceIndex] | KeyEventScanCode;
        }
        var sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(Input)));
        if (sent != inputs.Length) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
[Console]::Out.WriteLine('READY')
while ($null -ne ($request = [Console]::In.ReadLine())) {
    try {
        $separator = $request.IndexOf(';')
        if ($separator -lt 1) { throw 'Malformed SendInput request.' }
        $holdMilliseconds = [Int32]::Parse($request.Substring(0, $separator))
        $entries = $request.Substring($separator + 1).Split(',')
        $virtualKeys = New-Object 'System.Collections.Generic.List[UInt16]'
        $flags = New-Object 'System.Collections.Generic.List[UInt32]'
        foreach ($entry in $entries) {
            $parts = $entry.Split(':')
            $virtualKeys.Add([UInt16]::Parse($parts[0]))
            $flags.Add([UInt32]::Parse($parts[1]))
        }
        [PhoenixSendInput]::Send($virtualKeys.ToArray(), $flags.ToArray(), $holdMilliseconds)
        [Console]::Out.WriteLine('OK')
    } catch {
        $detail = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.ToString()))
        [Console]::Out.WriteLine("ERROR:$detail")
    }
}
`

const POWERSHELL_SENDINPUT_COMMAND = Buffer.from(POWERSHELL_SENDINPUT_SCRIPT, 'utf16le').toString('base64')
