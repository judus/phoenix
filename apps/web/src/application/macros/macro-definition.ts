import type { MacroDefinition, MacroRecording } from '@phoenix/contracts'
import { createClientId } from '../identity/client-identity.js'

export function macroDefinitionFromRecording(name: string, recording: MacroRecording): MacroDefinition {
  const entries = recording.entries.filter(entry => successfulRecording(entry.status))
  const steps: MacroDefinition['steps'] = []

  entries.forEach((entry, index) => {
    if (index > 0 && entry.delayBeforeMs > 0) {
      steps.push({ type: 'wait', durationMs: Math.min(entry.delayBeforeMs, 30_000) })
    }
    steps.push({ type: 'game-action', actionId: entry.actionId, operation: entry.operation })
  })

  return {
    assumptions: [],
    description: '',
    enabled: true,
    id: macroId(name),
    name,
    risk: 'safe',
    steps,
    version: 1
  }
}

function macroId(name: string): string {
  const normalized = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  return /^[a-z]/u.test(normalized) ? normalized : `macro-${normalized || createClientId().slice(-8)}`
}

function successfulRecording(status: MacroRecording['entries'][number]['status']): boolean {
  return ['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(status)
}
