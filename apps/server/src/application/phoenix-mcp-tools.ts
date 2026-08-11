import type { LocalTool } from '@maduser/ai-ts'
import type { GameCatalogue } from '@phoenix/elite'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { GameActions } from './game-action-service.js'
import { CommanderGetCurrentStateTool } from './mcp-tools/commander-get-current-state-tool.js'
import { CommanderGetInventoryTool } from './mcp-tools/commander-get-inventory-tool.js'
import { CommanderListEngineersTool } from './mcp-tools/commander-list-engineers-tool.js'
import { CommanderListMaterialsTool } from './mcp-tools/commander-list-materials-tool.js'
import { ControlsExecuteTool } from './mcp-tools/controls-execute-tool.js'
import { ControlsFindActionsTool } from './mcp-tools/controls-find-actions-tool.js'
import { ControlsGetStatusTool } from './mcp-tools/controls-get-status-tool.js'
import { ControlsSetSwitchTool } from './mcp-tools/controls-set-switch-tool.js'
import { ControlsTapTool } from './mcp-tools/controls-tap-tool.js'
import { DisplayShowBodyTool } from './mcp-tools/display-show-body-tool.js'
import { DisplayShowSystemTool } from './mcp-tools/display-show-system-tool.js'
import { NavigationCanJumpToTool } from './mcp-tools/navigation-can-jump-to-tool.js'
import { NavigationGetRouteTool } from './mcp-tools/navigation-get-route-tool.js'
import { ShipGetCargoTool } from './mcp-tools/ship-get-cargo-tool.js'
import { ShipGetStatusTool } from './mcp-tools/ship-get-status-tool.js'
import { ShipListModulesTool } from './mcp-tools/ship-list-modules-tool.js'
import { ShipsCompareTool } from './mcp-tools/ships-compare-tool.js'
import { ShipsGetDefinitionTool } from './mcp-tools/ships-get-definition-tool.js'
import { SystemsGetDetailsTool } from './mcp-tools/systems-get-details-tool.js'
import { MarketsFindBestTradeTool } from './mcp-tools/markets-find-best-trade-tool.js'
import { StationsFindNearestTool } from './mcp-tools/stations-find-nearest-tool.js'
import { StationsGetDetailsTool } from './mcp-tools/stations-get-details-tool.js'
import { StationsListShipyardStockTool } from './mcp-tools/stations-list-shipyard-stock-tool.js'
import { StationsSearchOutfittingTool } from './mcp-tools/stations-search-outfitting-tool.js'
import { ExplorationGetCurrentBodyTool } from './mcp-tools/exploration-get-current-body-tool.js'
import type { CommanderEngineersQuery, DisplayCommands, ExplorationBodyQuery, NavigationQuery, StationQuery, SystemDetailsQuery, TradeMarketQuery } from './mcp-tools/tool-gateways.js'
import type { StatefulGameActionService } from './stateful-game-action-service.js'

export interface PhoenixMcpToolDependencies {
  gameActions: GameActions
  gameCatalogue: GameCatalogue
  engineers: CommanderEngineersQuery
  display: DisplayCommands
  exploration: ExplorationBodyQuery
  navigation: NavigationQuery
  markets: TradeMarketQuery
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
    new ControlsFindActionsTool(dependencies.gameActions),
    new ControlsExecuteTool(dependencies.gameActions),
    new ControlsGetStatusTool(dependencies.gameActions),
    new ControlsSetSwitchTool(dependencies.statefulActions),
    new ControlsTapTool(dependencies.gameActions),
    new DisplayShowBodyTool(dependencies.display),
    new DisplayShowSystemTool(dependencies.display),
    new ExplorationGetCurrentBodyTool(dependencies.exploration),
    new NavigationCanJumpToTool(dependencies.navigation),
    new NavigationGetRouteTool(dependencies.navigation),
    new MarketsFindBestTradeTool(dependencies.markets),
    new ShipGetCargoTool(dependencies.runtimeState),
    new ShipGetStatusTool(dependencies.runtimeState),
    new ShipListModulesTool(dependencies.runtimeState),
    new ShipsCompareTool(dependencies.gameCatalogue),
    new ShipsGetDefinitionTool(dependencies.gameCatalogue),
    new StationsFindNearestTool(dependencies.stations),
    new StationsGetDetailsTool(dependencies.stations),
    new StationsListShipyardStockTool(dependencies.stations),
    new StationsSearchOutfittingTool(dependencies.stations),
    new SystemsGetDetailsTool(dependencies.systems)
  ]
}
