import { setTimeout as delay } from 'node:timers/promises'
import type { KeyboardOutput } from 'control-deck/adapter-keyboard'
import type { EliteDangerousBindingSource } from 'control-deck/integration-elite-dangerous'
import {
  ELITE_DESTINATION_BINDINGS,
  type EliteDestinationBinding,
  type EliteDestinationInput,
  type EliteDestinationInputStatus
} from '../domain/elite-destination.js'

const TEXT_KEY_DELAY_MS = 35

export class ControlDeckEliteDestinationInput implements EliteDestinationInput {
  public constructor (
    private readonly bindings: EliteDangerousBindingSource,
    private readonly output: KeyboardOutput
  ) {}

  public getStatus (): EliteDestinationInputStatus {
    const output = this.output.getStatus()
    const missingBindings = ELITE_DESTINATION_BINDINGS.filter(binding => this.bindings.resolve(binding) === null)
    return {
      available: output.available && missingBindings.length === 0,
      detail: !output.available
        ? output.detail
        : missingBindings.length > 0
          ? `Elite bindings are missing: ${missingBindings.join(', ')}.`
          : 'Elite Galaxy Map input is ready.',
      missingBindings
    }
  }

  public async tap (binding: EliteDestinationBinding, signal?: AbortSignal): Promise<void> {
    await this.output.send('tap', this.resolve(binding), requiredSignal(signal))
  }

  public async hold (binding: EliteDestinationBinding, durationMs: number, signal?: AbortSignal): Promise<void> {
    const resolved = this.resolve(binding)
    const operationSignal = requiredSignal(signal)
    await this.output.send('press', resolved, operationSignal)
    try {
      await delay(durationMs, undefined, { signal: operationSignal })
    } finally {
      await this.output.send('release', resolved, AbortSignal.timeout(1_000))
    }
  }

  public async tapKey (key: string, signal?: AbortSignal): Promise<void> {
    await this.output.send('tap', { key, modifiers: [] }, requiredSignal(signal))
  }

  public async typeText (text: string, signal?: AbortSignal): Promise<void> {
    const operationSignal = requiredSignal(signal)
    for (const character of text) {
      operationSignal.throwIfAborted()
      await this.output.send('tap', { key: textKey(character), modifiers: [] }, operationSignal)
      await delay(TEXT_KEY_DELAY_MS, undefined, { signal: operationSignal })
    }
  }

  private resolve (binding: EliteDestinationBinding) {
    const resolved = this.bindings.resolve(binding)
    if (!resolved) throw new Error(`Elite binding ${binding} is unavailable.`)
    return resolved
  }
}

function requiredSignal (signal?: AbortSignal): AbortSignal {
  return signal ?? new AbortController().signal
}

function textKey (character: string): string {
  if (character === ' ') return 'Space'
  if (character === '-') return 'Minus'
  if (character === '.') return 'Period'
  return character.toLocaleLowerCase()
}
