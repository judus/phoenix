import {
  LogicalInputChordSchema,
  type LogicalInputChord
} from '@phoenix/contracts'
import type { GameActionBindingResolver } from '../domain/game-actions.js'

const DEVELOPMENT_BINDINGS = new Map<string, LogicalInputChord>(Object.entries({
  ShipSpotLightToggle: chord('L'),
  NightVisionToggle: chord('N'),
  LandingGearToggle: chord('L', ['LeftAlt']),
  ToggleCargoScoop: chord('Home'),
  DeployHardpointToggle: chord('U'),
  FireChaffLauncher: chord('C')
}))

export class StaticGameActionBindingResolver implements GameActionBindingResolver {
  public resolve (eliteBinding: string): LogicalInputChord | null {
    return DEVELOPMENT_BINDINGS.get(eliteBinding) ?? null
  }
}

function chord (key: string, modifiers: string[] = []): LogicalInputChord {
  return LogicalInputChordSchema.parse({
    key,
    modifiers,
    display: [...modifiers, key].join('+')
  })
}
