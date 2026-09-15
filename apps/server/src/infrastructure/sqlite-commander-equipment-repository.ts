import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import type {
  CommanderEquipmentProjectionState,
  CommanderEquipmentRepository,
  CommanderSuitLoadoutRecord,
  CommanderSuitRecord,
  CommanderWeaponRecord
} from '../domain/commander-equipment.js'

const SCHEMA_MIGRATION = 23
const TimestampSchema = z.iso.datetime()

const UpgradeRecordSchema = z.object({
  grade: z.number().int().min(1).max(5),
  credits: z.number().int().nonnegative(),
  resources: z.array(z.object({
    symbol: z.string().min(1),
    localizedName: z.string().min(1).nullable(),
    count: z.number().int().positive()
  }).strict()),
  updatedAt: TimestampSchema
}).strict()

const EquipmentRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.number().int().nonnegative(),
  symbol: z.string().min(1),
  localizedName: z.string().min(1).nullable(),
  grade: z.number().int().min(1).max(5).nullable(),
  modificationSymbols: z.array(z.string().min(1)),
  purchasePrice: z.number().int().nonnegative().nullable(),
  purchasedAt: TimestampSchema.nullable(),
  lastUpgrade: UpgradeRecordSchema.nullable(),
  state: z.enum(['observed', 'sold']),
  updatedAt: TimestampSchema
}).strict()

const LoadoutRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.number().int().nonnegative(),
  name: z.string().min(1),
  suitId: z.number().int().nonnegative(),
  slots: z.array(z.object({
    slot: z.string().min(1),
    weaponId: z.number().int().nonnegative()
  }).strict()),
  state: z.enum(['observed', 'deleted']),
  updatedAt: TimestampSchema
}).strict()

export class SqliteCommanderEquipmentRepository implements CommanderEquipmentRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): boolean {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(SCHEMA_MIGRATION)) return false
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE commander_suits (
          suit_id INTEGER PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE TABLE commander_weapons (
          weapon_id INTEGER PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE TABLE commander_suit_loadouts (
          loadout_id INTEGER PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE TABLE commander_equipment_projection_state (
          state_key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          timestamp TEXT NOT NULL
        ) STRICT;
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (${SCHEMA_MIGRATION}, datetime('now'));
        COMMIT;
      `)
      return true
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public getLoadout (id: number): CommanderSuitLoadoutRecord | null {
    return this.getDocument('commander_suit_loadouts', 'loadout_id', id, LoadoutRecordSchema)
  }

  public getProjectionState (key: string): CommanderEquipmentProjectionState | null {
    const row = this.connection.prepare(`
      SELECT value, timestamp FROM commander_equipment_projection_state WHERE state_key = ?
    `).get(key) as CommanderEquipmentProjectionState | undefined
    return row ?? null
  }

  public getSuit (id: number): CommanderSuitRecord | null {
    return this.getDocument('commander_suits', 'suit_id', id, EquipmentRecordSchema)
  }

  public getWeapon (id: number): CommanderWeaponRecord | null {
    return this.getDocument('commander_weapons', 'weapon_id', id, EquipmentRecordSchema)
  }

  public listLoadouts (): CommanderSuitLoadoutRecord[] {
    return this.listDocuments('commander_suit_loadouts', 'updated_at DESC, loadout_id ASC', LoadoutRecordSchema)
  }

  public listSuits (): CommanderSuitRecord[] {
    return this.listDocuments('commander_suits', 'updated_at DESC, suit_id ASC', EquipmentRecordSchema)
  }

  public listWeapons (): CommanderWeaponRecord[] {
    return this.listDocuments('commander_weapons', 'updated_at DESC, weapon_id ASC', EquipmentRecordSchema)
  }

  public putLoadout (loadout: CommanderSuitLoadoutRecord): void {
    this.putDocument('commander_suit_loadouts', 'loadout_id', LoadoutRecordSchema.parse(loadout))
  }

  public putProjectionState (key: string, state: CommanderEquipmentProjectionState): void {
    this.connection.prepare(`
      INSERT INTO commander_equipment_projection_state (state_key, value, timestamp)
      VALUES (?, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET value = excluded.value, timestamp = excluded.timestamp
    `).run(key, state.value, state.timestamp)
  }

  public putSuit (suit: CommanderSuitRecord): void {
    this.putDocument('commander_suits', 'suit_id', EquipmentRecordSchema.parse(suit))
  }

  public putWeapon (weapon: CommanderWeaponRecord): void {
    this.putDocument('commander_weapons', 'weapon_id', EquipmentRecordSchema.parse(weapon))
  }

  private getDocument<T> (table: string, idColumn: string, id: number, schema: z.ZodType<T>): T | null {
    const row = this.connection.prepare(`SELECT document FROM ${table} WHERE ${idColumn} = ?`)
      .get(id) as { document: string } | undefined
    return row ? schema.parse(JSON.parse(row.document)) : null
  }

  private listDocuments<T> (table: string, order: string, schema: z.ZodType<T>): T[] {
    const rows = this.connection.prepare(`SELECT document FROM ${table} ORDER BY ${order}`).all() as Array<{ document: string }>
    return rows.map(row => schema.parse(JSON.parse(row.document)))
  }

  private putDocument (
    table: 'commander_suits' | 'commander_weapons' | 'commander_suit_loadouts',
    idColumn: 'suit_id' | 'weapon_id' | 'loadout_id',
    record: CommanderSuitRecord | CommanderWeaponRecord | CommanderSuitLoadoutRecord
  ): void {
    this.connection.prepare(`
      INSERT INTO ${table} (${idColumn}, state, updated_at, document)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(${idColumn}) DO UPDATE SET
        state = excluded.state,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(record.id, record.state, record.updatedAt, JSON.stringify(record))
  }
}
