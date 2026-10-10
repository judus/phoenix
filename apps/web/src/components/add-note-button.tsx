import { IconButton, NoteIcon } from '@phoenix/ui'
import type { PersonalNoteTarget } from '@phoenix/contracts'
import type { PhoenixRoute } from '../application/navigation/phoenix-route.js'

export function AddNoteButton({ className, label = 'Add note', onNavigate, target }: {
  className?: string
  label?: string
  onNavigate(route: PhoenixRoute): void
  target: PersonalNoteTarget
}) {
  return <IconButton className={className} type="button" variant="outline" label={label}
    onClick={() => onNavigate({ kind: 'notes', newNote: true, target })}><NoteIcon /></IconButton>
}
