import type { PersonalNote, PersonalNoteRecord, PersonalNoteTarget, PersonalNoteWriteRequest, PersonalNotesResponse } from '@phoenix/contracts'
import { galaxyBookmarkTargetKey } from './galaxy-bookmarks.js'

export interface PersonalNoteRepository {
  get(id: string): PersonalNoteRecord | null
  list(): PersonalNoteRecord[]
  put(note: PersonalNoteRecord): void
  delete(id: string): void
}
export interface PersonalNotes {
  get(id: string): PersonalNote | null
  search(query?: string, target?: PersonalNoteTarget): PersonalNotesResponse
  create(input: PersonalNoteWriteRequest, author: PersonalNote['createdBy']): PersonalNote
  update(id: string, input: PersonalNoteWriteRequest, author: PersonalNote['updatedBy']): PersonalNote | null
  delete(id: string): void
}
export function personalNoteTargetKey(target: PersonalNoteTarget): string {
  return target.kind === 'mission' ? `mission:${target.missionId}` : galaxyBookmarkTargetKey(target)
}
