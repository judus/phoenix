import {
  CatalogueDiagnosticsSchema,
  ShipCatalogueResponseSchema,
  type CatalogueDiagnostics,
  type ShipCatalogueResponse
} from '@phoenix/contracts'
import type { GameCatalogue } from '@phoenix/elite'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export interface CatalogueDiagnosticsReader {
  getDiagnostics(): CatalogueDiagnostics
  getShips(): ShipCatalogueResponse
}

export class CatalogueDiagnosticsService implements CatalogueDiagnosticsReader {
  public constructor (
    private readonly catalogue: GameCatalogue,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public getDiagnostics (): CatalogueDiagnostics {
    const ship = this.runtimeState.getCurrent().ship
    const catalogueModules = ship.modules.filter(module => module.definition?.source.kind === 'catalogue').length
    const inferredModules = ship.modules.filter(module => module.definition?.source.kind === 'inferred').length
    return CatalogueDiagnosticsSchema.parse({
      ...this.catalogue.getDiagnostics(),
      currentShip: {
        typeId: ship.typeId,
        displayName: ship.definition?.displayName ?? null,
        shipResolved: ship.definition !== null,
        moduleCount: ship.modules.length,
        catalogueModules,
        inferredModules
      }
    })
  }

  public getShips (): ShipCatalogueResponse {
    return ShipCatalogueResponseSchema.parse({ ships: this.catalogue.listShips() })
  }
}
