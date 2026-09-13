import type { DatabaseSync } from 'node:sqlite'
import { EngineeringProjectSchema, type EngineeringProject } from '@phoenix/contracts'
import type { EngineeringProjectRepository } from '../domain/engineering-projects.js'

const SCHEMA_MIGRATION = 19

export class SqliteEngineeringProjectRepository implements EngineeringProjectRepository {
  public constructor (private readonly connection: DatabaseSync) {}

  public initialize (): void {
    const applied = this.connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(SCHEMA_MIGRATION)
    if (applied) return
    this.connection.exec('BEGIN IMMEDIATE')
    try {
      this.connection.exec(`
        CREATE TABLE engineering_projects (
          project_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          priority TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          document TEXT NOT NULL
        ) STRICT;
        CREATE INDEX engineering_projects_status_priority
        ON engineering_projects (status, priority, updated_at DESC);
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (${SCHEMA_MIGRATION}, datetime('now'));
        COMMIT;
      `)
    } catch (cause) {
      this.connection.exec('ROLLBACK')
      throw cause
    }
  }

  public deleteProject (id: string): void {
    this.connection.prepare('DELETE FROM engineering_projects WHERE project_id = ?').run(id)
  }

  public getProject (id: string): EngineeringProject | null {
    const row = this.connection.prepare('SELECT document FROM engineering_projects WHERE project_id = ?')
      .get(id) as { document: string } | undefined
    return row ? EngineeringProjectSchema.parse(JSON.parse(row.document)) : null
  }

  public listProjects (): EngineeringProject[] {
    const rows = this.connection.prepare(`
      SELECT document FROM engineering_projects
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        updated_at DESC, project_id ASC
    `).all() as Array<{ document: string }>
    return rows.map(row => EngineeringProjectSchema.parse(JSON.parse(row.document)))
  }

  public putProject (project: EngineeringProject): void {
    const validated = EngineeringProjectSchema.parse(project)
    this.connection.prepare(`
      INSERT INTO engineering_projects (project_id, status, priority, updated_at, document)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        status = excluded.status,
        priority = excluded.priority,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).run(validated.id, validated.status, validated.priority, validated.updatedAt, JSON.stringify(validated))
  }
}
