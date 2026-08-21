import {
  type ControlDeckConfiguration,
  type ControlDeckDeck,
  type ControlDeckDeckGroup
} from '@jdu/control-deck-core'
import { PhoenixControlDeckConfigurationSchema, phoenixTargetToControlDeckTarget, type GameActionCategory } from '@phoenix/contracts'

const SHIP_ELEMENTS = [
  element(1, 'GalaxyMapOpen'),
  element(3, 'Supercruise'),
  element(4, 'Hyperspace'),
  element(5, 'UseBoostJuice'),
  element(6, 'SelectHighestThreat'),
  element(7, 'CyclePreviousHostileTarget'),
  element(8, 'CycleNextHostileTarget'),
  element(9, 'SystemMapOpen'),
  element(10, 'OrbitLinesToggle'),
  element(11, 'SelectTarget'),
  element(12, 'CyclePreviousSubsystem'),
  element(13, 'CycleNextSubsystem'),
  element(14, 'TargetNextRouteSystem'),
  element(15, 'ShipSpotLightToggle'),
  element(16, 'NightVisionToggle'),
  element(17, 'ToggleCargoScoop'),
  element(18, 'LandingGearToggle'),
  element(19, 'DeployHardpointToggle'),
  element(21, 'CyclePreviousTarget'),
  element(22, 'CycleNextTarget'),
  element(23, 'RecallDismissShip'),
  element(25, 'IncreaseEnginesPower'),
  element(26, 'IncreaseWeaponsPower'),
  element(27, 'IncreaseSystemsPower'),
  element(28, 'ResetPowerDistribution'),
  element(29, 'RadarDecreaseRange'),
  element(30, 'RadarIncreaseRange'),
  element(31, 'CycleFireGroupPrevious'),
  element(32, 'CycleFireGroupNext'),
  element(33, 'FireChaffLauncher', 2),
  element(35, 'DeployHeatSink', 2),
  element(37, 'UseShieldCell', 2),
  element(39, 'EjectAllCargo', 2)
]

const DEFINITIONS: ReadonlyArray<{ category: GameActionCategory, label: string }> = [
  { category: 'ship', label: 'Ship' },
  { category: 'combat', label: 'Combat' },
  { category: 'navigation', label: 'Navigation' },
  { category: 'vessel', label: 'Vessel' },
  { category: 'srv', label: 'SRV' },
  { category: 'on_foot', label: 'On Foot' },
  { category: 'radio', label: 'Radio' },
  { category: 'emote', label: 'Emotes' },
  { category: 'misc', label: 'Miscellaneous' }
]

export const DEFAULT_CONTROL_DECK_CONFIGURATION: ControlDeckConfiguration = PhoenixControlDeckConfigurationSchema.parse({
  version: 1,
  revision: 0,
  groups: DEFINITIONS.map(group),
  decks: DEFINITIONS.map(deck),
  displays: []
})

export const BLANK_CONTROL_DECK_CONFIGURATION: ControlDeckConfiguration = PhoenixControlDeckConfigurationSchema.parse({
  ...DEFAULT_CONTROL_DECK_CONFIGURATION,
  decks: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.map(deck => ({
    ...deck,
    layoutPresetId: null,
    elements: []
  }))
})

function group ({ category, label }: { category: GameActionCategory, label: string }): ControlDeckDeckGroup {
  return { id: category, name: label, description: '' }
}

function deck ({ category }: { category: GameActionCategory }): ControlDeckDeck {
  return {
    id: category,
    groupId: category,
    name: 'S1',
    description: '',
    context: `phoenix:${category}`,
    ...(category === 'ship' ? { layoutPresetId: 'phoenix.ship' } : {}),
    layout: { kind: 'grid', columns: 8, rows: 5 },
    elements: category === 'ship' ? SHIP_ELEMENTS : []
  }
}

function element (position: number, eliteBinding: string, columnSpan = 1) {
  return {
    id: `cell_${position}`,
    kind: 'command' as const,
    target: phoenixTargetToControlDeckTarget({ type: 'game-action', actionId: `elite.${eliteBinding}` }),
    appearance: { label: null, icon: null, foregroundColor: null, backgroundColor: null },
    interaction: {
      activation: 'command-default' as const,
      confirmation: eliteBinding === 'EjectAllCargo'
        ? { kind: 'arm-then-tap' as const, armedForMs: 5_000 }
        : { kind: 'none' as const }
    },
    placement: {
      kind: 'grid' as const,
      column: (position - 1) % 8 + 1,
      row: Math.floor((position - 1) / 8) + 1,
      columnSpan,
      rowSpan: 1
    }
  }
}
