import type { LocalTool } from '@maduser/ai-ts'
import type { GameCatalogue } from '@phoenix/elite'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { GameActions } from './game-action-service.js'
import { CommanderGetCurrentStateTool } from './mcp-tools/commander-get-current-state-tool.js'
import { CommanderGetInventoryTool } from './mcp-tools/commander-get-inventory-tool.js'
import { CommanderListMaterialsTool } from './mcp-tools/commander-list-materials-tool.js'
import { ControlsExecuteTool } from './mcp-tools/controls-execute-tool.js'
import { ControlsFindActionsTool } from './mcp-tools/controls-find-actions-tool.js'
import { ControlsGetStatusTool } from './mcp-tools/controls-get-status-tool.js'
import { ControlsSetSwitchTool } from './mcp-tools/controls-set-switch-tool.js'
import { ControlsTapTool } from './mcp-tools/controls-tap-tool.js'
import { ShipGetCargoTool } from './mcp-tools/ship-get-cargo-tool.js'
import { ShipGetStatusTool } from './mcp-tools/ship-get-status-tool.js'
import { ShipListModulesTool } from './mcp-tools/ship-list-modules-tool.js'
import { ShipsCompareTool } from './mcp-tools/ships-compare-tool.js'
import { ShipsGetDefinitionTool } from './mcp-tools/ships-get-definition-tool.js'
import type { StatefulGameActionService } from './stateful-game-action-service.js'

export interface PhoenixMcpToolDependencies {
  gameActions: GameActions
  gameCatalogue: GameCatalogue
  runtimeState: RuntimeStateReader
  statefulActions: StatefulGameActionService
}

/**
 * Only tools backed by working PHOENIX dependencies are registered here.
 * Deferred legacy tool classes live beside these tools and become discoverable
 * only when their navigation, display, engineer, or external-data gateway exists.
 */
export function createPhoenixMcpTools (dependencies: PhoenixMcpToolDependencies): LocalTool[] {
  return [
    new CommanderGetCurrentStateTool(dependencies.runtimeState),
    new CommanderGetInventoryTool(dependencies.runtimeState),
    new CommanderListMaterialsTool(dependencies.runtimeState),
    new ControlsFindActionsTool(dependencies.gameActions),
    new ControlsExecuteTool(dependencies.gameActions),
    new ControlsGetStatusTool(dependencies.gameActions),
    new ControlsSetSwitchTool(dependencies.statefulActions),
    new ControlsTapTool(dependencies.gameActions),
    new ShipGetCargoTool(dependencies.runtimeState),
    new ShipGetStatusTool(dependencies.runtimeState),
    new ShipListModulesTool(dependencies.runtimeState),
    new ShipsCompareTool(dependencies.gameCatalogue),
    new ShipsGetDefinitionTool(dependencies.gameCatalogue)
  ]
}
