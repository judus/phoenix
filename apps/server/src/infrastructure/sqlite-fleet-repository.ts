import type { DatabaseSync } from 'node:sqlite'
import { FleetShipSchema, StoredModuleSchema, type FleetShip, type StoredModule } from '@phoenix/contracts'
import type { FleetRepository } from '../domain/fleet.js'

/** Fleet operations share the connection and schema lifecycle owned by SqliteDatabase. */
export class SqliteFleetRepository implements FleetRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public getFleetProjectionTimestamp (key: string): string | null {
    const row = this.connection.prepare(`
      SELECT timestamp FROM fleet_projection_state WHERE state_key = ?
    `).get(key) as { timestamp: string } | undefined
    return row?.timestamp ?? null
  }

  public putFleetProjectionTimestamp (key: string, timestamp: string): void {
    this.connection.prepare(`
      INSERT INTO fleet_projection_state (state_key, timestamp)
      VALUES (?, ?)
      ON CONFLICT(state_key) DO UPDATE SET timestamp = excluded.timestamp
    `).run(key, timestamp)
  }

  public getFleetShip (id: number): FleetShip | null {
    const row = this.connection.prepare(`SELECT document FROM fleet_ships WHERE ship_id = ?`).get(id) as { document: string } | undefined
    return row ? FleetShipSchema.parse(JSON.parse(row.document)) : null
  }

  public listFleetShips (): FleetShip[] {
    const rows = this.connection.prepare(`SELECT document FROM fleet_ships ORDER BY updated_at DESC, ship_id ASC`).all() as Array<{ document: string }>
    return rows.map(row => FleetShipSchema.parse(JSON.parse(row.document)))
  }

  public putFleetShip (ship: FleetShip): void {
    const validated = FleetShipSchema.parse(ship)
    this.connection.prepare(`
      INSERT INTO fleet_ships (ship_id, state, updated_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ship_id) DO UPDATE SET
        state = excluded.state,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(validated.id, validated.state, validated.updatedAt, JSON.stringify(validated))
  }

  public listStoredModules (): StoredModule[] {
    const rows = this.connection.prepare(`SELECT document FROM fleet_stored_modules ORDER BY storage_slot ASC`).all() as Array<{ document: string }>
    return rows.map(row => StoredModuleSchema.parse(JSON.parse(row.document)))
  }

  public replaceStoredModules (modules: StoredModule[]): void {
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec('DELETE FROM fleet_stored_modules')
      const statement = this.connection.prepare(`
        INSERT INTO fleet_stored_modules (storage_slot, updated_at, document)
        VALUES (?, ?, ?)
      `)
      for (const module of modules) {
        const validated = StoredModuleSchema.parse(module)
        statement.run(validated.storageSlot, validated.updatedAt, JSON.stringify(validated))
      }
      this.connection.exec('COMMIT')
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }
}
