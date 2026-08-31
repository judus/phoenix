import {
  createPlatformKeyboardOutput,
  detectLinuxDisplaySession,
  LinuxXdotoolKeyboardOutput,
  RecordingKeyboardOutput,
  WindowsSendInputKeyboardOutput,
  type KeyboardOutput,
  type KeyboardOutputStatus,
  type PlatformKeyboardOutputOptions
} from 'control-deck/adapter-keyboard'
import {
  InputBackendModeSchema,
  RuntimeSystemSnapshotSchema,
  type InputBackendMode,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'

export interface ControlOutputBootstrapOptions {
  createPlatformOutput?: (options: PlatformKeyboardOutputOptions) => KeyboardOutput
  createSendInputOutput?: () => KeyboardOutput
  createXdotoolOutput?: () => KeyboardOutput
  environment?: NodeJS.ProcessEnv
  now?: () => Date
  platform?: NodeJS.Platform
  waylandRestoreTokenPath?: string
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
    ? selectOutput(requestedBackend, platform, environment, options)
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
  environment: NodeJS.ProcessEnv,
  options: ControlOutputBootstrapOptions
): { id: string, output: KeyboardOutput } {
  if (mode === 'recording') return { id: 'recording', output: new RecordingKeyboardOutput() }
  if (mode === 'linux-xdotool') return { id: 'linux-xdotool', output: options.createXdotoolOutput?.() ?? new LinuxXdotoolKeyboardOutput({ environment }) }
  if (mode === 'windows-sendinput') return { id: 'windows-sendinput', output: options.createSendInputOutput?.() ?? new WindowsSendInputKeyboardOutput({ platform }) }

  const platformOptions: PlatformKeyboardOutputOptions = {
    environment,
    platform,
    ...(options.waylandRestoreTokenPath ? { waylandRestoreTokenPath: options.waylandRestoreTokenPath } : {})
  }
  return {
    id: automaticOutputId(platform, environment),
    output: options.createPlatformOutput?.(platformOptions) ?? createPlatformKeyboardOutput(platformOptions)
  }
}

function automaticOutputId (platform: NodeJS.Platform, environment: NodeJS.ProcessEnv): string {
  if (platform === 'linux') {
    return detectLinuxDisplaySession(environment).kind === 'wayland'
      ? 'linux-wayland-portal'
      : 'linux-xdotool'
  }
  if (platform === 'win32') return 'windows-sendinput'
  return `unsupported-${platform}`
}

class DisabledKeyboardOutput implements KeyboardOutput {
  public constructor (private readonly detail: string) {}
  public getStatus (): KeyboardOutputStatus {
    return { available: false, simulated: false, detail: this.detail, platformRequirements: [] }
  }
  public send (): Promise<void> { return Promise.reject(new Error(this.detail)) }
}
