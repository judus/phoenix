import type {
  EliteDangerousBindingDiagnostics,
  EliteDangerousBindingSource,
  EliteDangerousResolvedBinding
} from 'control-deck/integration-elite-dangerous'

const DEVELOPMENT_BINDINGS = new Map<string, EliteDangerousResolvedBinding['binding']>(Object.entries({
  ShipSpotLightToggle: chord('L'),
  NightVisionToggle: chord('N'),
  LandingGearToggle: chord('L', ['LeftAlt']),
  ToggleCargoScoop: chord('Home'),
  DeployHardpointToggle: chord('U'),
  FireChaffLauncher: chord('C'),
  PrimaryFire: chord('Space')
}))

export class StaticEliteDangerousBindings implements EliteDangerousBindingSource {
  public resolve (eliteBinding: string): EliteDangerousResolvedBinding['binding'] | null {
    const binding = DEVELOPMENT_BINDINGS.get(eliteBinding)
    return binding ? structuredClone(binding) : null
  }

  public listBindings (): EliteDangerousResolvedBinding[] {
    return [...DEVELOPMENT_BINDINGS.entries()]
      .map(([eliteBinding, binding]) => ({ eliteBinding, binding: structuredClone(binding) }))
      .sort((left, right) => left.eliteBinding.localeCompare(right.eliteBinding))
  }

  public listCommands (): string[] { return [...DEVELOPMENT_BINDINGS.keys()].sort() }

  public getDiagnostics (): EliteDangerousBindingDiagnostics {
    return {
      directory: null,
      filePath: null,
      presetNames: ['PHOENIX test bindings'],
      available: true,
      bindingCount: DEVELOPMENT_BINDINGS.size,
      keyboardBindingCount: DEVELOPMENT_BINDINGS.size,
      loadedAt: null,
      error: null
    }
  }

  public refresh (): EliteDangerousBindingDiagnostics { return this.getDiagnostics() }
  public startWatching (): void {}
  public stopWatching (): void {}
}

function chord (key: string, modifiers: string[] = []): EliteDangerousResolvedBinding['binding'] {
  return { key, modifiers, display: [...modifiers, key].join('+') }
}
