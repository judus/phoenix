import type { DatabaseSync } from 'node:sqlite'
import { ColonisationResponseSchema, type ColonisationClaim, type ColonisationContribution, type ColonisationDepot, type ColonisationResponse } from '@phoenix/contracts'
import type { ColonisationRepository } from '../domain/colonisation.js'

export class SqliteColonisationRepository implements ColonisationRepository {
  public constructor(private readonly connection: DatabaseSync) {}

  public initialize(): void {
    if (this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 32').get()) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE colonisation_depots (market_id INTEGER PRIMARY KEY, updated_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
        CREATE TABLE colonisation_claims (system_address INTEGER PRIMARY KEY, updated_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
        CREATE TABLE colonisation_contributions (entry_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
        CREATE INDEX colonisation_contribution_time ON colonisation_contributions(occurred_at DESC);
        DELETE FROM elite_journal_checkpoints;
        INSERT INTO schema_migrations VALUES (32, datetime('now'));
        COMMIT;
      `)
    } catch (cause) { this.connection.exec('ROLLBACK'); throw cause }
  }

  public putDepot(depot: ColonisationDepot): void {
    this.connection.prepare(`INSERT INTO colonisation_depots VALUES (?, ?, ?) ON CONFLICT(market_id)
      DO UPDATE SET updated_at = excluded.updated_at, document = excluded.document
      WHERE excluded.updated_at >= colonisation_depots.updated_at`).run(depot.marketId, depot.updatedAt, JSON.stringify(depot))
  }

  public putClaim(claim: ColonisationClaim): void {
    this.connection.prepare(`INSERT INTO colonisation_claims VALUES (?, ?, ?) ON CONFLICT(system_address)
      DO UPDATE SET updated_at = excluded.updated_at, document = excluded.document
      WHERE excluded.updated_at >= colonisation_claims.updated_at`).run(claim.systemAddress, claim.updatedAt, JSON.stringify(claim))
  }

  public putContribution(contribution: ColonisationContribution): void {
    this.connection.prepare('INSERT INTO colonisation_contributions VALUES (?, ?, ?) ON CONFLICT(entry_id) DO NOTHING')
      .run(contribution.id, contribution.timestamp, JSON.stringify(contribution))
  }

  public read(): ColonisationResponse {
    const documents = (sql: string) => (this.connection.prepare(sql).all() as Array<{ document: string }>).map(row => JSON.parse(row.document))
    return ColonisationResponseSchema.parse({
      depots: documents('SELECT document FROM colonisation_depots ORDER BY updated_at DESC, market_id'),
      claims: documents('SELECT document FROM colonisation_claims ORDER BY updated_at DESC, system_address'),
      contributions: documents('SELECT document FROM colonisation_contributions ORDER BY occurred_at DESC, rowid DESC LIMIT 100'),
      retainedContributions: (this.connection.prepare('SELECT count(*) AS count FROM colonisation_contributions').get() as { count: number }).count
    })
  }
}
