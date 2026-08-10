import {
  InputBackendModeSchema,
  RuntimeSystemSnapshotSchema,
  type InputBackendMode,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type { InputBackend } from '../domain/game-actions.js'
import { LinuxXdotoolInputBackend } from '../infrastructure/linux-xdotool-input-backend.js'
import { RecordingInputBackend } from '../infrastructure/recording-input-backend.js'
import { UnavailableInputBackend } from '../infrastructure/unavailable-input-backend.js'

export interface ControlBackendBootstrapOptions {
  createXdotoolBackend?: () => InputBackend
  environment?: NodeJS.ProcessEnv
  now?: () => Date
  platform?: NodeJS.Platform
}

export interface ControlBackendBootstrapResult {
  backend: InputBackend
  snapshot: RuntimeSystemSnapshot
}

export function bootstrapControlBackend (
  settings: PhoenixSettings,
  options: ControlBackendBootstrapOptions = {}
): ControlBackendBootstrapResult {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const overrideBackend = environment.PHOENIX_INPUT_BACKEND
    ? InputBackendModeSchema.parse(environment.PHOENIX_INPUT_BACKEND)
    : null
  const requestedBackend = overrideBackend ?? settings.controls.backend
  const backend = settings.controls.enabled
    ? selectBackend(requestedBackend, platform, options.createXdotoolBackend)
    : new UnavailableInputBackend('disabled', 'Game controls are disabled in PHOENIX settings.')
  const status = backend.getStatus()

  return {
    backend,
    snapshot: RuntimeSystemSnapshotSchema.parse({
      version: 1,
      generatedAt: (options.now ?? (() => new Date()))().toISOString(),
      platform,
      session: environment.XDG_SESSION_TYPE || null,
      controls: {
        enabled: settings.controls.enabled,
        configuredBackend: settings.controls.backend,
        overrideBackend,
        effectiveBackend: status.id,
        available: status.available,
        simulated: status.simulated,
        detail: status.detail
      }
    })
  }
}

function selectBackend (
  mode: InputBackendMode,
  platform: NodeJS.Platform,
  createXdotoolBackend: (() => InputBackend) | undefined
): InputBackend {
  if (mode === 'recording') return new RecordingInputBackend()
  if (mode === 'linux-xdotool') return createXdotoolBackend?.() ?? new LinuxXdotoolInputBackend()

  if (platform === 'linux') return createXdotoolBackend?.() ?? new LinuxXdotoolInputBackend()
  return new UnavailableInputBackend(
    `unsupported-${platform}`,
    `Automatic game input is not implemented for ${platform}.`
  )
}
