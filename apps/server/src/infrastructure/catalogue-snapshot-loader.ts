import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { JsonEngineeringCatalogue, JsonGameCatalogue } from '@phoenix/elite'

export interface CatalogueSnapshotPaths {
  directory: string
  engineeringDirectory: string
  modules: string
  ships: string
}

export class CatalogueSnapshotLoader {
  public load (preferred: CatalogueSnapshotPaths | null, fallback: CatalogueSnapshotPaths) {
    if (preferred && existsSync(join(preferred.directory, 'manifest.json'))) {
      try {
        return this.loadFrom(preferred)
      } catch (error) {
        console.warn('PHOENIX catalogue refresh snapshot is invalid; using bundled catalogue.', error)
      }
    }
    return this.loadFrom(fallback)
  }

  private loadFrom (paths: CatalogueSnapshotPaths) {
    return {
      engineering: new JsonEngineeringCatalogue({
        blueprints: join(paths.engineeringDirectory, 'blueprints.json'),
        engineers: join(paths.engineeringDirectory, 'engineers.json'),
        materials: join(paths.engineeringDirectory, 'materials.json'),
        materialUses: join(paths.engineeringDirectory, 'material-uses.json')
      }),
      game: new JsonGameCatalogue(paths.ships, paths.modules)
    }
  }
}
