import { randomUUID } from 'node:crypto'
import { PersonalNoteRecordSchema, PersonalNoteWriteRequestSchema, type PersonalNote, type PersonalNoteRecord, type PersonalNoteTarget, type PersonalNoteWriteRequest } from '@phoenix/contracts'
import type { MissionRepository } from '../domain/missions.js'
import { personalNoteTargetKey, type PersonalNoteRepository, type PersonalNotes } from '../domain/personal-notes.js'

export class PersonalNoteService implements PersonalNotes {
  public constructor(private readonly repository: PersonalNoteRepository,
    private readonly missions: Pick<MissionRepository, 'getMission'>,
    private readonly now: () => Date = () => new Date(), private readonly createId: () => string = randomUUID) {}

  private present(note: PersonalNoteRecord): PersonalNote {
    const mission = note.target?.kind === 'mission' ? this.missions.getMission(note.target.missionId) : null
    return { ...note, missionTitle: mission?.localizedName ?? mission?.name ?? null }
  }
  public get(id: string): PersonalNote | null {
    const note = this.repository.get(id)
    return note ? this.present(note) : null
  }
  public search(query = '', target?: PersonalNoteTarget) {
    const needle = query.trim().toLocaleLowerCase()
    const key = target ? personalNoteTargetKey(target) : null
    return { notes: this.repository.list().map(note => this.present(note)).filter(note =>
      (key === null || (note.target !== null && personalNoteTargetKey(note.target) === key)) &&
      (!needle || `${note.title}\n${note.text}\n${note.missionTitle ?? ''}\n${note.target ? personalNoteTargetKey(note.target) : ''}`.toLocaleLowerCase().includes(needle))) }
  }
  public create(input: PersonalNoteWriteRequest, author: PersonalNote['createdBy']): PersonalNote {
    const normalized = PersonalNoteWriteRequestSchema.parse(input)
    const timestamp = this.now().toISOString()
    const note = PersonalNoteRecordSchema.parse({ ...normalized, id: this.createId(),
      createdAt: timestamp, updatedAt: timestamp, createdBy: author, updatedBy: author })
    this.repository.put(note)
    return this.present(note)
  }
  public update(id: string, input: PersonalNoteWriteRequest, author: PersonalNote['updatedBy']): PersonalNote | null {
    const normalized = PersonalNoteWriteRequestSchema.parse(input)
    const existing = this.repository.get(id)
    if (!existing) return null
    const note = PersonalNoteRecordSchema.parse({ ...existing, ...normalized,
      updatedAt: this.now().toISOString(), updatedBy: author })
    this.repository.put(note)
    return this.present(note)
  }
  public delete(id: string): void { this.repository.delete(id) }
}
