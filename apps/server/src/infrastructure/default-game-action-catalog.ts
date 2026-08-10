import {
  GameActionDefinitionSchema,
  type GameActionDefinition
} from '@phoenix/contracts'
import type { GameActionCatalog } from '../domain/game-actions.js'

const DEFAULT_ACTIONS: GameActionDefinition[] = GameActionDefinitionSchema.array().parse([
  {
    id: 'ship.lights.toggle',
    label: 'Ship Lights',
    description: 'Toggle the ship exterior lights.',
    category: 'ship',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'ShipSpotLightToggle',
    telemetryKey: 'lightsOn'
  },
  {
    id: 'ship.night_vision.toggle',
    label: 'Night Vision',
    description: 'Toggle ship night vision.',
    category: 'ship',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'NightVisionToggle',
    telemetryKey: 'nightVision'
  },
  {
    id: 'ship.landing_gear.toggle',
    label: 'Landing Gear',
    description: 'Toggle the ship landing gear.',
    category: 'ship',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'LandingGearToggle',
    telemetryKey: 'landingGearDown'
  },
  {
    id: 'ship.cargo_hatch.toggle',
    label: 'Cargo Hatch',
    description: 'Toggle the ship cargo scoop.',
    category: 'ship',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'ToggleCargoScoop',
    telemetryKey: 'cargoScoopDeployed'
  },
  {
    id: 'ship.hardpoints.toggle',
    label: 'Hardpoints',
    description: 'Deploy or retract the ship hardpoints.',
    category: 'combat',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'DeployHardpointToggle',
    telemetryKey: 'hardpointsDeployed'
  },
  {
    id: 'combat.chaff.fire',
    label: 'Chaff',
    description: 'Fire a chaff launcher.',
    category: 'combat',
    inputMode: 'tap',
    risk: 'routine',
    eliteBinding: 'FireChaffLauncher',
    telemetryKey: null
  }
])

export class DefaultGameActionCatalog implements GameActionCatalog {
  private readonly actions = new Map(DEFAULT_ACTIONS.map(action => [action.id, action]))

  public find (actionId: string): GameActionDefinition | undefined {
    return this.actions.get(actionId)
  }

  public list (): GameActionDefinition[] {
    return [...this.actions.values()]
  }
}
