import { ControlGridLayoutSchema, type ControlGridLayout } from '@phoenix/contracts'

const SHIP_CELLS = [
  cell(1, 'GalaxyMapOpen'),
  cell(3, 'Supercruise'),
  cell(4, 'Hyperspace'),
  cell(5, 'UseBoostJuice'),
  cell(6, 'SelectHighestThreat'),
  cell(7, 'CyclePreviousHostileTarget'),
  cell(8, 'CycleNextHostileTarget'),
  cell(9, 'SystemMapOpen'),
  cell(10, 'OrbitLinesToggle'),
  cell(11, 'SelectTarget'),
  cell(12, 'CyclePreviousSubsystem'),
  cell(13, 'CycleNextSubsystem'),
  cell(14, 'TargetNextRouteSystem'),
  cell(15, 'ShipSpotLightToggle'),
  cell(16, 'NightVisionToggle'),
  cell(17, 'ToggleCargoScoop'),
  cell(18, 'LandingGearToggle'),
  cell(19, 'DeployHardpointToggle'),
  cell(21, 'CyclePreviousTarget'),
  cell(22, 'CycleNextTarget'),
  cell(23, 'RecallDismissShip'),
  cell(25, 'IncreaseEnginesPower'),
  cell(26, 'IncreaseWeaponsPower'),
  cell(27, 'IncreaseSystemsPower'),
  cell(28, 'ResetPowerDistribution'),
  cell(29, 'RadarDecreaseRange'),
  cell(30, 'RadarIncreaseRange'),
  cell(31, 'CycleFireGroupPrevious'),
  cell(32, 'CycleFireGroupNext'),
  cell(33, 'FireChaffLauncher', 2),
  cell(35, 'DeployHeatSink', 2),
  cell(37, 'UseShieldCell', 2),
  cell(39, 'EjectAllCargo', 2)
]

export const DEFAULT_CONTROL_GRID_LAYOUT: ControlGridLayout = ControlGridLayoutSchema.parse({
  version: 4,
  pages: [
    page('ship', 'Ship', SHIP_CELLS),
    page('combat', 'Combat'),
    page('navigation', 'Navigation'),
    page('vessel', 'Vessel'),
    page('srv', 'SRV'),
    page('on_foot', 'On Foot'),
    page('radio', 'Radio'),
    page('emote', 'Emotes'),
    page('misc', 'Miscellaneous')
  ]
})

function page (
  id: ControlGridLayout['pages'][number]['category'],
  label: string,
  cells: ControlGridLayout['pages'][number]['cells'] = []
) {
  return {
    id,
    label,
    category: id,
    columns: 8,
    rows: 5,
    layoutPresetId: id === 'ship' ? 'phoenix.ship' : null,
    cells
  }
}

function cell (position: number, eliteBinding: string, span = 1) {
  return { position, span, target: { type: 'game-action' as const, actionId: `elite.${eliteBinding}` } }
}
