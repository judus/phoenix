import type { JsonObject, ToolExecutionOutput } from '@judus/llm-client'

export type DeferredToolResult = Promise<ToolExecutionOutput> | ToolExecutionOutput

/** Narrow ports for legacy capabilities whose PHOENIX adapters do not exist yet. */
export interface CommanderEngineersQuery {
  listEngineers(arguments_: JsonObject): DeferredToolResult
}

export interface DisplayCommands {
  showBody(arguments_: JsonObject): DeferredToolResult
  showSystem(arguments_: JsonObject): DeferredToolResult
}

export interface ExplorationBodyQuery {
  getCurrentBody(arguments_: JsonObject): DeferredToolResult
}

export interface TradeMarketQuery {
  findBestTrade(arguments_: JsonObject): DeferredToolResult
}

export interface NavigationQuery {
  canJumpTo(arguments_: JsonObject): DeferredToolResult
  getRoute(arguments_: JsonObject): DeferredToolResult
}

export interface StationQuery {
  findNearest(arguments_: JsonObject): DeferredToolResult
  findOutfitting(arguments_: JsonObject): DeferredToolResult
  findShipyards(arguments_: JsonObject): DeferredToolResult
  getDetails(arguments_: JsonObject): DeferredToolResult
  listShipyardStock(arguments_: JsonObject): DeferredToolResult
  lookup(arguments_: JsonObject): DeferredToolResult
  searchOutfitting(arguments_: JsonObject): DeferredToolResult
}

export interface SystemDetailsQuery {
  getDetails(arguments_: JsonObject): DeferredToolResult
}

export interface SystemSearchQuery {
  searchSystems(arguments_: JsonObject): DeferredToolResult
}
