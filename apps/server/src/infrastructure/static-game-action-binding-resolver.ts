import {
  GameActionBindingSourceDiagnosticsSchema,
  LogicalInputChordSchema,
  ResolvedGameActionBindingSchema,
  type ResolvedGameActionBinding,
  type LogicalInputChord
} from '@phoenix/contracts'
import type { GameActionBindingResolver } from '../domain/game-actions.js'

const DEVELOPMENT_BINDINGS = new Map<string, LogicalInputChord>(Object.entries({
  ShipSpotLightToggle: chord('L'),
  NightVisionToggle: chord('N'),
  LandingGearToggle: chord('L', ['LeftAlt']),
  ToggleCargoScoop: chord('Home'),
  DeployHardpointToggle: chord('U'),
  FireChaffLauncher: chord('C'),
  PrimaryFire: chord('Space')
}))

export class StaticGameActionBindingResolver implements GameActionBindingResolver {
  public resolve (eliteBinding: string): LogicalInputChord | null {
    return DEVELOPMENT_BINDINGS.get(eliteBinding) ?? null
  }

  public listBindings (): ResolvedGameActionBinding[] {
    return [...DEVELOPMENT_BINDINGS.entries()]
      .map(([eliteBinding, binding]) => ResolvedGameActionBindingSchema.parse({ eliteBinding, binding }))
      .sort((left, right) => left.eliteBinding.localeCompare(right.eliteBinding))
  }

  public listCommands (): string[] {
    return [...DEVELOPMENT_BINDINGS.keys()].sort()
  }

  public getDiagnostics () {
    return GameActionBindingSourceDiagnosticsSchema.parse({
      directory: null,
      filePath: null,
      presetNames: ['PHOENIX development defaults'],
      available: true,
      bindingCount: DEVELOPMENT_BINDINGS.size,
      keyboardBindingCount: DEVELOPMENT_BINDINGS.size,
      loadedAt: null,
      error: null
    })
  }
}

function chord (key: string, modifiers: string[] = []): LogicalInputChord {
  return LogicalInputChordSchema.parse({
    key,
    modifiers,
    display: [...modifiers, key].join('+')
  })
}
