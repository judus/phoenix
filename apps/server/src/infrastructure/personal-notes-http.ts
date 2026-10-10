import type { IncomingMessage, ServerResponse } from 'node:http'
import { PersonalNoteWriteRequestSchema } from '@phoenix/contracts'
import type { PersonalNotes } from '../domain/personal-notes.js'
import { readValidatedJsonBody, writeJson } from './http-json.js'

/** Dispatch only after the shared pairing boundary. Storage faults remain server errors. */
export async function handlePersonalNotesRequest(request: IncomingMessage, response: ServerResponse, url: URL, notes: PersonalNotes): Promise<boolean> {
  if (url.pathname === '/api/notes' && request.method === 'GET') {
    writeJson(response, 200, notes.search(url.searchParams.get('query') ?? ''))
    return true
  }
  if (url.pathname === '/api/notes' && request.method === 'POST') {
    writeJson(response, 201, notes.create(await readValidatedJsonBody(request, PersonalNoteWriteRequestSchema), 'player'))
    return true
  }
  const match = url.pathname.match(/^\/api\/notes\/([^/]+)$/u)
  if (!match) return false
  const id = decodeURIComponent(match[1]!)
  if (request.method === 'GET' || request.method === 'PUT') {
    const note = request.method === 'GET' ? notes.get(id)
      : notes.update(id, await readValidatedJsonBody(request, PersonalNoteWriteRequestSchema), 'player')
    writeJson(response, note ? 200 : 404, note ?? { error: { code: 'note_not_found', message: 'That note no longer exists.' } })
    return true
  }
  if (request.method === 'DELETE') {
    notes.delete(id)
    response.writeHead(204)
    response.end()
    return true
  }
  return false
}
