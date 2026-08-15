import type { LocalTool } from '@judus/llm-client'
import type { GameCatalogue } from '@phoenix/elite'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { Commands } from '../domain/commands.js'
import { CommanderGetCurrentStateTool } from './mcp-tools/commander-get-current-state-tool.js'
import { CommanderGetInventoryTool } from './mcp-tools/commander-get-inventory-tool.js'
import { CommanderListEngineersTool } from './mcp-tools/commander-list-engineers-tool.js'
import { CommanderListMaterialsTool } from './mcp-tools/commander-list-materials-tool.js'
import { ControlsExecuteTool } from './mcp-tools/controls-execute-tool.js'
import { ControlsFindActionsTool } from './mcp-tools/controls-find-actions-tool.js'
import { ControlsSetSwitchTool } from './mcp-tools/controls-set-switch-tool.js'
import { DisplayShowBodyTool } from './mcp-tools/display-show-body-tool.js'
import { DisplayShowSystemTool } from './mcp-tools/display-show-system-tool.js'
import { NavigationCanJumpToTool } from './mcp-tools/navigation-can-jump-to-tool.js'
import { NavigationGetRouteTool } from './mcp-tools/navigation-get-route-tool.js'
import { ShipGetCargoTool } from './mcp-tools/ship-get-cargo-tool.js'
import { ShipGetStatusTool } from './mcp-tools/ship-get-status-tool.js'
import { ShipListModulesTool } from './mcp-tools/ship-list-modules-tool.js'
import { ShipsCompareTool } from './mcp-tools/ships-compare-tool.js'
import { ShipsGetDefinitionTool } from './mcp-tools/ships-get-definition-tool.js'
import { ShipsFindShipyardsTool } from './mcp-tools/ships-find-shipyards-tool.js'
import { SystemsGetDetailsTool } from './mcp-tools/systems-get-details-tool.js'
import { MarketsFindBestTradeTool } from './mcp-tools/markets-find-best-trade-tool.js'
import { StationsFindNearestTool } from './mcp-tools/stations-find-nearest-tool.js'
import { StationsGetDetailsTool } from './mcp-tools/stations-get-details-tool.js'
import { StationsListShipyardStockTool } from './mcp-tools/stations-list-shipyard-stock-tool.js'
import { StationsSearchOutfittingTool } from './mcp-tools/stations-search-outfitting-tool.js'
import { ExplorationGetCurrentBodyTool } from './mcp-tools/exploration-get-current-body-tool.js'
import { OperationsListMissionsTool } from './mcp-tools/operations-list-missions-tool.js'
import { OutfittingFindModuleTool } from './mcp-tools/outfitting-find-module-tool.js'
import { CommsListMessagesTool } from './mcp-tools/comms-list-messages-tool.js'
import { FleetListShipsTool } from './mcp-tools/fleet-list-ships-tool.js'
import { FleetListStoredModulesTool } from './mcp-tools/fleet-list-stored-modules-tool.js'
import type { CommanderEngineersQuery, DisplayCommands, ExplorationBodyQuery, NavigationQuery, StationQuery, SystemDetailsQuery, TradeMarketQuery } from './mcp-tools/tool-gateways.js'
import type { StatefulGameActionService } from './stateful-game-action-service.js'
import type { MissionDataReader } from '../domain/missions.js'
import type { CommunicationDataReader } from '../domain/communications.js'
import type { FleetDataReader } from '../domain/fleet.js'

export interface PhoenixMcpToolDependencies {
  commands: Commands
  communications: CommunicationDataReader
  gameCatalogue: GameCatalogue
  engineers: CommanderEngineersQuery
  display: DisplayCommands
  exploration: ExplorationBodyQuery
  fleet: FleetDataReader
  navigation: NavigationQuery
  markets: TradeMarketQuery
  missions: MissionDataReader
  runtimeState: RuntimeStateReader
  statefulActions: StatefulGameActionService
  stations: StationQuery
  systems: SystemDetailsQuery
}

/**
 * Only tools backed by working PHOENIX dependencies are registered here.
 * Deferred legacy tool classes live beside these tools and become discoverable
 * only when their exploration, market, station, or other external-data gateway exists.
 */
export function createPhoenixMcpTools (dependencies: PhoenixMcpToolDependencies): LocalTool[] {
  return [
    new CommanderGetCurrentStateTool(dependencies.runtimeState),
    new CommanderGetInventoryTool(dependencies.runtimeState),
    new CommanderListEngineersTool(dependencies.engineers),
    new CommanderListMaterialsTool(dependencies.runtimeState),
    new CommsListMessagesTool(dependencies.communications),
    new ControlsFindActionsTool(dependencies.commands),
    new ControlsExecuteTool(dependencies.commands),
    new ControlsSetSwitchTool(dependencies.statefulActions),
    new DisplayShowBodyTool(dependencies.display),
    new DisplayShowSystemTool(dependencies.display),
    new ExplorationGetCurrentBodyTool(dependencies.exploration),
    new FleetListShipsTool(dependencies.fleet),
    new FleetListStoredModulesTool(dependencies.fleet),
    new NavigationCanJumpToTool(dependencies.navigation),
    new NavigationGetRouteTool(dependencies.navigation),
    new OperationsListMissionsTool(dependencies.missions),
    new OutfittingFindModuleTool(dependencies.stations),
    new MarketsFindBestTradeTool(dependencies.markets),
    new ShipGetCargoTool(dependencies.runtimeState),
    new ShipGetStatusTool(dependencies.runtimeState),
    new ShipListModulesTool(dependencies.runtimeState),
    new ShipsCompareTool(dependencies.gameCatalogue),
    new ShipsFindShipyardsTool(dependencies.stations),
    new ShipsGetDefinitionTool(dependencies.gameCatalogue),
    new StationsFindNearestTool(dependencies.stations),
    new StationsGetDetailsTool(dependencies.stations),
    new StationsListShipyardStockTool(dependencies.stations),
    new StationsSearchOutfittingTool(dependencies.stations),
    new SystemsGetDetailsTool(dependencies.systems)
  ]
}
