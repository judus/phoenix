import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { join } from 'node:path'
import type { EliteJournalEvent } from './elite-journal-file-source.js'

/** Read only journal-triggered game snapshots, never provider/cache data. */
export class EliteJournalSnapshotReader {
  public constructor (private readonly directory: string | null) {}

  public read (event: EliteJournalEvent): Record<string, unknown> | undefined {
    if (!this.directory || !['Market', 'Outfitting', 'Shipyard', 'NavRoute', 'FCMaterials'].includes(event.event)) return undefined
    let file: number | undefined
    try {
      file = openSync(join(this.directory, `${event.event}.json`), 'r')
      const before = fstatSync(file)
      if (!before.isFile() || before.size > 2 * 1024 * 1024) return undefined
      const bytes = Buffer.alloc(before.size)
      if (readSync(file, bytes, 0, bytes.length, 0) !== bytes.length) return undefined
      const after = fstatSync(file)
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) return undefined
      const snapshot: unknown = JSON.parse(bytes.toString('utf8'))
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined
      return snapshot as Record<string, unknown>
    } catch {
      // Missing, partial or replaced snapshots are not observation evidence.
      return undefined
    } finally {
      if (file !== undefined) closeSync(file)
    }
  }
}
