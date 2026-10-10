import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { ToolRegistry } from '@jdu/llm-client'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PersonalNoteService } from '../apps/server/src/application/personal-note-service.js'
import { MissionDataService } from '../apps/server/src/application/mission-data-service.js'
import { MissionsListMissionsTool } from '../apps/server/src/application/mcp-tools/missions-list-missions-tool.js'
import { createPersonalNoteTools } from '../apps/server/src/application/mcp-tools/personal-note-tools.js'
import { withToolErrorBoundary } from '../apps/server/src/application/mcp-tools/tool-error-boundary.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { CopilotToolRegistry } from '../apps/server/src/application/copilot-tool-registry.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { PersonalNotesPage } from '../apps/web/src/features/notes/personal-notes-page.js'
import { ActivitiesPage } from '../apps/web/src/features/activities/activities-page.js'
import { PersonalNoteWriteRequestSchema } from '@phoenix/contracts'
import { phoenixApiStub } from './support/phoenix-api-stub.js'
import { renderWithAct } from './support/render-with-act.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'

const context = { callId: 'notes', runId: 'notes', deadline: '2026-10-10T12:00:00Z', signal: new AbortController().signal }
const input = { title: '  Prepare equipment  ', text: '  Bring an e-breach.  ', target: { kind: 'mission' as const, missionId: 42 } }

test('empty notes are valid; mission names resolve from current records rather than being stored', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new PersonalNoteService(database.personalNotes, database)
    expect(PersonalNoteWriteRequestSchema.parse({ target: null })).toEqual({ title: '', text: '', target: null })
    const note = service.create({ ...input, title: '', text: '' }, 'player')
    expect(note.missionTitle).toBeNull()
    const missions = new MissionDataService(database)
    missions.ingest({ event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 42,
      LocalisedName: 'Retrieve documents' }, 'live-journal')
    expect(service.get(note.id)?.missionTitle).toBe('Retrieve documents')
    expect(service.search('documents').notes.map(note => note.id)).toEqual([note.id])
    expect(database.personalNotes.get(note.id)).not.toHaveProperty('missionTitle')
  } finally { database.close() }
})

test('cards show short notes, empty notes and readable links without opening the editor', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new PersonalNoteService(database.personalNotes, database)
    new MissionDataService(database).ingest({ event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z',
      MissionID: 42, LocalisedName: 'Retrieve documents' }, 'live-journal')
    service.create({ ...input, title: '' }, 'player')
    service.create({ title: '', text: '', target: null }, 'player')
    service.create({ title: '7', text: '', target: { kind: 'body', systemName: 'Sol', bodyName: 'Earth' } }, 'player')
    service.create({ title: '', text: 'Fuel', target: { kind: 'station', systemName: 'Sol', stationName: 'Galileo' } }, 'player')
    const navigate = vi.fn()
    const renderer = await renderWithAct(<PersonalNotesPage api={phoenixApiStub({ getPersonalNotes: async () => service.search() })}
      route={{ kind: 'notes' }} onNavigate={navigate} />)
    try {
      expect(renderer.root.findAllByType('article')).toHaveLength(4)
      expect(JSON.stringify(renderer.toJSON())).toContain('Bring an e-breach.')
      expect(JSON.stringify(renderer.toJSON())).toContain('Empty note')
      const links = renderer.root.findAllByType('a')
      const missionLink = links.find(link => link.props.href === '#/activities/missions?mission=42')!
      expect(missionLink.findByType('strong').children).toEqual(['Retrieve documents'])
      expect(JSON.stringify(renderer.toJSON())).toContain('Retrieve documents')
      expect(links.some(link => link.props.href === '#/galaxy/system?name=Sol&selected=Earth')).toBe(true)
      expect(links.some(link => link.props.href === '#/galaxy/system?name=Sol&selected=Galileo')).toBe(true)
      const header = renderer.root.findAllByType('header').find(header => header.props.className?.includes('page-header'))!
      expect(header.findAllByType('nav').find(nav => nav.props['aria-label'] === 'Breadcrumb')!.findAllByType('li').map(item => item.findByType('span').children)).toEqual([['Notes']])
      expect(header.findByType('input').props.id).toBe('note-search')
      expect(header.findByType('label').props.htmlFor).toBe('note-search')
      expect(header.findAllByType('button').find(button => button.props['aria-label'] === 'New note')!.props.className).toContain('btn-primary')
      await act(async () => header.findByType('input').props.onChange({ target: { value: 'e-breach' } }))
      expect(renderer.root.findAllByType('article')).toHaveLength(1)
      await act(async () => header.findAllByType('button').find(button => button.props['aria-label'] === 'New note')!.props.onClick())
      expect(navigate).toHaveBeenCalledWith({ kind: 'notes', newNote: true })
    } finally { await act(async () => renderer.unmount()) }
  } finally { database.close() }
})

test('mission deep links select a non-default mission and do not silently select another missing mission', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new MissionDataService(database)
    for (const id of [42, 43]) service.ingest({ event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z',
      MissionID: id, LocalisedName: `Contract ${id}` }, 'live-journal')
    const route = { kind: 'information' as const, section: 'activities' as const, view: 'missions' as const, selectedMissionId: 43 }
    expect(parsePhoenixRoute(phoenixRouteHash(route))).toEqual(route)
    const controller = { status: 'ready' as const, missions: service.getMissions() }
    const addNote = vi.fn()
    const renderer = await renderWithAct(<ActivitiesPage controller={controller} view="missions" selectedMissionId={43} onAddNote={addNote} />)
    try {
      const button = renderer.root.findAllByType('button').find(button => button.children.includes('Add note'))!
      await act(async () => button.props.onClick())
      expect(addNote).toHaveBeenCalledWith(43)
      await act(async () => renderer.update(<ActivitiesPage controller={controller} view="missions" selectedMissionId={99} onAddNote={addNote} />))
      expect(JSON.stringify(renderer.toJSON())).toContain('The linked mission is no longer available')
      expect(renderer.root.findAllByType('button').some(button => button.children.includes('Add note'))).toBe(false)
    } finally { await act(async () => renderer.unmount()) }
  } finally { database.close() }
})

test('notes survive mission completion and restart; author and last editor remain distinct', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-notes-test-'))
  const path = join(directory, 'test.sqlite')
  let database = new SqliteDatabase(path)
  try {
    database.initialize()
    const notes = new PersonalNoteService(database.personalNotes, database)
    const created = notes.create(input, 'copilot')
    expect(created).toMatchObject({ title: 'Prepare equipment', text: 'Bring an e-breach.', createdBy: 'copilot', updatedBy: 'copilot' })
    const missions = new MissionDataService(database)
    missions.ingest({ event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 42 }, 'live-journal')
    missions.ingest({ event: 'MissionCompleted', timestamp: '2026-10-10T12:05:00Z', MissionID: 42 }, 'live-journal')
    const updated = notes.update(created.id, { ...input, text: 'Use the east entrance.' }, 'player')!
    expect(updated).toMatchObject({ createdBy: 'copilot', updatedBy: 'player', createdAt: created.createdAt })
    database.close()
    database = new SqliteDatabase(path)
    database.initialize()
    const restarted = new PersonalNoteService(database.personalNotes, database)
    expect(restarted.get(created.id)).toEqual(updated)
    expect(restarted.search('east', { kind: 'mission', missionId: 42 }).notes).toEqual([updated])
    expect(restarted.search('', { kind: 'mission', missionId: 43 }).notes).toEqual([])
    expect(restarted.update('missing', input, 'player')).toBeNull()
    restarted.delete(created.id)
    expect(restarted.search().notes).toEqual([])
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('location links reuse existing normalized identity and never require the entity to be available', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const notes = new PersonalNoteService(database.personalNotes, database)
    const note = notes.create({ ...input, target: { kind: 'station', systemName: ' Sol ', stationName: 'Galileo' } }, 'player')
    expect(notes.search('', { kind: 'station', systemName: 'sol', stationName: 'GALILEO' }).notes).toEqual([note])
    expect(notes.search('', { kind: 'system', systemName: 'Sol' }).notes).toEqual([])
    expect(notes.create({ title: '', text: ' ', target: null }, 'player')).toMatchObject({ title: '', text: '', target: null })
    expect(() => notes.create({ ...input, text: 'x'.repeat(16001) }, 'player')).toThrow()
  } finally { database.close() }
})

test('Copilot tools preserve attribution, validate usage, and mission retrieval respects notes read permission', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const notes = new PersonalNoteService(database.personalNotes, database)
    const tools = createPersonalNoteTools(notes).map(withToolErrorBoundary)
    const registry = new ToolRegistry(tools)
    const invoke = (name: string, arguments_: Record<string, never> | typeof input | { id: string }) =>
      registry.execute({ id: 'call', name, arguments: arguments_ }, context)
    await invoke('notes.create_note', input)
    const note = notes.search().notes[0]!
    expect(note.createdBy).toBe('copilot')
    await expect(invoke('notes.get_note', { id: 'not-a-uuid' })).rejects.toMatchObject({ category: 'tool_validation' })
    await expect(invoke('notes.get_note', { id: '00000000-0000-4000-8000-000000000001' })).rejects.toThrow('notes.search_notes')
    await registry.execute({ id: 'update', name: 'notes.update_note', arguments: { ...input, id: note.id, text: 'Updated explicitly.' } }, context)
    expect(notes.get(note.id)?.text).toBe('Updated explicitly.')
    const settings = new InMemorySystemSettingsRepository()
    const capabilities = new DefaultCopilotCapabilityService(() => tools.map(tool => tool.definition),
      { find: () => undefined, getCatalog: () => ({ commands: [] }) }, settings)
    capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: ['tool:notes.search_notes'] })
    capabilities.saveProfilePolicy('marin', { version: 2, enabledCapabilityIds: ['tool:notes.search_notes'] })
    const permitted = new CopilotToolRegistry(tools, capabilities)
    expect(capabilities.catalogue().groups.some(group => group.label === 'Personal notes')).toBe(true)
    await expect(permitted.execute({ id: 'denied', name: 'notes.create_note', arguments: input }, context)).rejects.toMatchObject({ category: 'authorization' })
    const missions = new MissionDataService(database)
    missions.ingest({ event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 42 }, 'live-journal')
    let allowed = true
    const missionTool = new MissionsListMissionsTool(missions, notes, () => allowed)
    expect(JSON.stringify(await missionTool.execute({}))).toContain('Updated explicitly.')
    allowed = false
    expect(JSON.stringify(await missionTool.execute({}))).not.toContain('Updated explicitly.')
  } finally { database.close() }
})

test('HTTP notes boundary validates bodies, attributes player writes, searches and returns 404 for missing notes', async () => {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null })
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const api = new PhoenixApiClient(origin)
    const created = await api.savePersonalNote(input)
    expect(created.createdBy).toBe('player')
    expect((await api.getPersonalNotes('e-breach')).notes).toEqual([created])
    const invalid = await fetch(`${origin}/api/notes`, { method: 'POST', body: JSON.stringify({ ...input, createdBy: 'copilot' }) })
    expect(invalid.status).toBe(400)
    const updated = await api.savePersonalNote({ ...input, target: null }, created.id)
    expect(updated.target).toBeNull()
    await api.deletePersonalNote(created.id)
    expect((await api.getPersonalNotes()).notes).toEqual([])
    expect((await fetch(`${origin}/api/notes/${created.id}`)).status).toBe(404)
    expect((await fetch(`${origin}/api/notes/${created.id}`, { method: 'PUT', body: JSON.stringify(input) })).status).toBe(404)
  } finally { await application.stop() }
})

test('notes routes round-trip linked new notes and edits', () => {
  for (const target of [null, input.target, { kind: 'station' as const, systemName: 'Sol', stationName: 'Galileo' },
    { kind: 'body' as const, systemName: 'Sol', bodyName: 'Earth' }]) {
    const route = { kind: 'notes' as const, newNote: true, ...(target ? { target } : {}) }
    expect(parsePhoenixRoute(phoenixRouteHash(route))).toEqual(route)
  }
  expect(parsePhoenixRoute('#/notes?new=1&mission=')).toEqual({ kind: 'notes', newNote: true })
})

test('pairing blocks notes before validation and writes; storage faults remain HTTP 500', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-notes-pairing-'))
  const accessControl = new PairingAccessController(join(directory, 'pairing.json'))
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null, accessControl })
  const create = vi.spyOn(PersonalNoteService.prototype, 'create')
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    for (const [path, method] of [['/api/notes', 'GET'], ['/api/notes', 'POST'], ['/api/notes/absent', 'PUT'], ['/api/notes/absent', 'DELETE']]) {
      const response = await fetch(`${origin}${path}`, { method, ...(method === 'GET' ? {} : { body: '{' }) })
      expect(response.status).toBe(401)
    }
    expect(create).not.toHaveBeenCalled()
    const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST', body: JSON.stringify({ code: accessControl.pairingCode }) })
    const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
    create.mockImplementationOnce(() => { throw new Error('Synthetic storage failure') })
    const failed = await fetch(`${origin}/api/notes`, { method: 'POST', headers: { cookie }, body: JSON.stringify(input) })
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toMatchObject({ error: { code: 'internal_error' } })
    const valid = await fetch(`${origin}/api/notes`, { method: 'POST', headers: { cookie }, body: JSON.stringify(input) })
    expect(valid.status).toBe(201)
  } finally { create.mockRestore(); await application.stop(); rmSync(directory, { recursive: true, force: true }) }
})

test('notes editor saves the mission link and returns to the list without losing authored text', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const notes = new PersonalNoteService(database.personalNotes, database)
    const onNavigate = vi.fn()
    const save = vi.fn(async value => notes.create(value, 'player'))
    const api = phoenixApiStub({ getPersonalNotes: async () => notes.search(), savePersonalNote: save })
    const renderer = await renderWithAct(<PersonalNotesPage api={api} onNavigate={onNavigate}
      route={{ kind: 'notes', newNote: true, target: input.target }} />)
    try {
      await act(async () => {
        renderer.root.findByProps({ id: 'note-title' }).props.onChange({ target: { value: 'Prepare' } })
        renderer.root.findByProps({ id: 'note-text' }).props.onChange({ target: { value: 'Bring e-breach.' } })
      })
      await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
      expect(save).toHaveBeenCalledWith({ title: 'Prepare', text: 'Bring e-breach.', target: input.target }, undefined)
      expect(onNavigate).toHaveBeenCalledWith({ kind: 'notes' })
    } finally { await act(async () => renderer.unmount()) }
  } finally { database.close() }
})
