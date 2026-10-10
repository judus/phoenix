import type { DatabaseSync } from 'node:sqlite'
import { PersonalNoteRecordSchema, type PersonalNoteRecord } from '@phoenix/contracts'
import type { PersonalNoteRepository } from '../domain/personal-notes.js'

export class SqlitePersonalNoteRepository implements PersonalNoteRepository {
  public constructor(private readonly connection: DatabaseSync) {}
  public initialize(): void {
    this.connection.exec(`CREATE TABLE IF NOT EXISTS personal_notes (
      note_id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, document TEXT NOT NULL
    ) STRICT;`)
  }
  public get(id: string): PersonalNoteRecord | null {
    const row = this.connection.prepare('SELECT document FROM personal_notes WHERE note_id = ?').get(id) as { document: string } | undefined
    return row ? PersonalNoteRecordSchema.parse(JSON.parse(row.document)) : null
  }
  public list(): PersonalNoteRecord[] {
    return (this.connection.prepare('SELECT document FROM personal_notes ORDER BY updated_at DESC, note_id ASC').all() as Array<{ document: string }>)
      .map(row => PersonalNoteRecordSchema.parse(JSON.parse(row.document)))
  }
  public put(note: PersonalNoteRecord): void {
    const validated = PersonalNoteRecordSchema.parse(note)
    this.connection.prepare(`INSERT INTO personal_notes (note_id, updated_at, document) VALUES (?, ?, ?)
      ON CONFLICT(note_id) DO UPDATE SET updated_at = excluded.updated_at, document = excluded.document`)
      .run(validated.id, validated.updatedAt, JSON.stringify(validated))
  }
  public delete(id: string): void {
    this.connection.prepare('DELETE FROM personal_notes WHERE note_id = ?').run(id)
  }
}
