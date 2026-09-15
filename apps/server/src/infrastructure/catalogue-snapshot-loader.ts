import { join } from 'node:path'
import { JsonEngineeringCatalogue, JsonGameCatalogue, JsonPersonalEquipmentCatalogue } from '@phoenix/elite'

export interface CatalogueSnapshotPaths {
  commodities: string
  engineeringDirectory: string
  modules: string
  personalEquipment: string
  ships: string
}

export class CatalogueSnapshotLoader {
  public load (paths: CatalogueSnapshotPaths) {
    return {
      engineering: new JsonEngineeringCatalogue({
        blueprints: join(paths.engineeringDirectory, 'blueprints.json'),
        engineers: join(paths.engineeringDirectory, 'engineers.json'),
        materials: join(paths.engineeringDirectory, 'materials.json'),
        materialUses: join(paths.engineeringDirectory, 'material-uses.json')
      }),
      game: new JsonGameCatalogue(paths.ships, paths.modules, paths.commodities),
      personalEquipment: new JsonPersonalEquipmentCatalogue(paths.personalEquipment)
    }
  }
}
