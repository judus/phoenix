import {
  LinuxXdotoolKeyboardOutput,
  RecordingKeyboardOutput,
  WindowsSendInputKeyboardOutput,
  type KeyboardOutput,
  type KeyboardOutputStatus
} from 'control-deck/adapter-keyboard'
import {
  InputBackendModeSchema,
  RuntimeSystemSnapshotSchema,
  type InputBackendMode,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'

export interface ControlOutputBootstrapOptions {
  createSendInputOutput?: () => KeyboardOutput
  createXdotoolOutput?: () => KeyboardOutput
  environment?: NodeJS.ProcessEnv
  now?: () => Date
  platform?: NodeJS.Platform
}

export interface ControlOutputBootstrapResult {
  id: string
  output: KeyboardOutput
  snapshot: RuntimeSystemSnapshot
}

export function bootstrapControlOutput (
  settings: PhoenixSettings,
  options: ControlOutputBootstrapOptions = {}
): ControlOutputBootstrapResult {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const overrideBackend = environment.PHOENIX_INPUT_BACKEND
    ? InputBackendModeSchema.parse(environment.PHOENIX_INPUT_BACKEND)
    : null
  const requestedBackend = overrideBackend ?? settings.controls.backend
  const selected = settings.controls.enabled
    ? selectOutput(requestedBackend, platform, options.createXdotoolOutput, options.createSendInputOutput)
    : { id: 'disabled', output: new DisabledKeyboardOutput('Game controls are disabled in PHOENIX settings.') }
  const status = selected.output.getStatus()

  return {
    ...selected,
    snapshot: RuntimeSystemSnapshotSchema.parse({
      version: 1,
      generatedAt: (options.now ?? (() => new Date()))().toISOString(),
      platform,
      session: environment.XDG_SESSION_TYPE || null,
      controls: {
        enabled: settings.controls.enabled,
        configuredBackend: settings.controls.backend,
        overrideBackend,
        effectiveBackend: selected.id,
        available: status.available,
        simulated: status.simulated,
        detail: status.detail
      }
    })
  }
}

function selectOutput (
  mode: InputBackendMode,
  platform: NodeJS.Platform,
  createXdotoolOutput: (() => KeyboardOutput) | undefined,
  createSendInputOutput: (() => KeyboardOutput) | undefined
): { id: string, output: KeyboardOutput } {
  if (mode === 'recording') return { id: 'recording', output: new RecordingKeyboardOutput() }
  if (mode === 'linux-xdotool') return { id: 'linux-xdotool', output: createXdotoolOutput?.() ?? new LinuxXdotoolKeyboardOutput() }
  if (mode === 'windows-sendinput') return { id: 'windows-sendinput', output: createSendInputOutput?.() ?? new WindowsSendInputKeyboardOutput({ platform }) }
  if (platform === 'linux') return { id: 'linux-xdotool', output: createXdotoolOutput?.() ?? new LinuxXdotoolKeyboardOutput() }
  if (platform === 'win32') return { id: 'windows-sendinput', output: createSendInputOutput?.() ?? new WindowsSendInputKeyboardOutput({ platform }) }
  return { id: `unsupported-${platform}`, output: new DisabledKeyboardOutput(`Automatic game input is not implemented for ${platform}.`) }
}

class DisabledKeyboardOutput implements KeyboardOutput {
  public constructor (private readonly detail: string) {}
  public getStatus (): KeyboardOutputStatus {
    return { available: false, simulated: false, detail: this.detail, platformRequirements: [] }
  }
  public send (): Promise<void> { return Promise.reject(new Error(this.detail)) }
}
