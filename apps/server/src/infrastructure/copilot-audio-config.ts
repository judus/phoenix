import { readFileSync } from 'node:fs'
import { CopilotAudioProcessingSchema, type CopilotAudioProcessing } from '@phoenix/contracts'

export function readCopilotAudioProcessing (path: string): CopilotAudioProcessing {
  try {
    return CopilotAudioProcessingSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch (cause) {
    throw new Error(`Unable to load Copilot audio configuration: ${path}`, { cause })
  }
}
