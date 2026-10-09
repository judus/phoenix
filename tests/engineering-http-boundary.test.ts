import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { EngineeringProjectSchema, EngineeringProjectsChangedSchema } from '@phoenix/contracts'
import { PhoenixApplication, type PhoenixApplicationOptions } from '../apps/server/src/phoenix-application.js'
import { EngineeringProjectService } from '../apps/server/src/application/engineering-project-service.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { readSseEvents } from './support/sse-events.js'

async function withServer(run: (origin: string) => Promise<void>, options: PhoenixApplicationOptions = {}) {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null, ...options })
  try {
    const address = await application.start()
    await run(`http://${address.host}:${address.port}`)
  } finally { await application.stop() }
}

test('Engineering catalogue routes preserve headers, categories and blueprint lookup', async () => {
  await withServer(async origin => {
    for (const path of ['engineers', 'materials', 'blueprints', 'experimental-effects', 'projects', 'material-watchlist']) {
      const response = await fetch(`${origin}/api/engineering/${path}?ignored=yes`)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
      const body = await response.text()
      expect(Number(response.headers.get('content-length'))).toBe(Buffer.byteLength(body))
      expect(JSON.parse(body)).toBeTypeOf('object')
    }
    const api = new PhoenixApiClient(origin)
    for (const category of ['raw', 'manufactured', 'encoded', 'xeno'] as const) {
      expect((await api.getEngineeringMaterials(category)).materials.every(material => material.category === category)).toBe(true)
    }
    const invalid = await fetch(`${origin}/api/engineering/materials?category=Raw`)
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: {
      code: 'invalid_material_category', message: 'Unknown material category: Raw.'
    } })
    expect((await api.getEngineeringBlueprint('TestModule_Reinforced')).symbol).toBe('TestModule_Reinforced')
    const encoded = await fetch(`${origin}/api/engineering/blueprints/%54estModule_Reinforced`)
    expect(encoded.status).toBe(200)
    await expect(encoded.json()).resolves.toMatchObject({ symbol: 'TestModule_Reinforced' })
    const missing = await fetch(`${origin}/api/engineering/blueprints/missing`)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'blueprint_not_found' } })
  })
})

test('Engineering project and step mutations preserve status codes, persisted state and watchlist', async () => {
  await withServer(async origin => {
    const api = new PhoenixApiClient(origin)
    const created = await fetch(`${origin}/api/engineering/projects`, { method: 'POST', body: JSON.stringify({ name: '  Fixture refit  ' }) })
    expect(created.status).toBe(201)
    const project = EngineeringProjectSchema.parse(await created.json())
    expect(project).toMatchObject({ name: 'Fixture refit', priority: 'normal', note: null, status: 'active', steps: [] })
    const projectPath = `${origin}/api/engineering/projects/${encodeURIComponent(project.id)}`
    const step = await fetch(`${projectPath}/steps`, { method: 'POST', body: JSON.stringify({
      blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls: 4
    }) })
    expect(step.status).toBe(201)
    const planned = EngineeringProjectSchema.parse(await step.json())
    expect(planned.steps[0]).toMatchObject({ plannedRolls: 4, requirements: [{ materialId: 'TestWidgets', required: 4 }] })
    expect((await api.getEngineeringProjects()).projects).toEqual([planned])
    expect(await api.getEngineeringMaterialWatchlist()).toMatchObject({ activeProjectCount: 1,
      materials: [expect.objectContaining({ materialId: 'TestWidgets', required: 4 })] })
    const updated = await fetch(projectPath, { method: 'PUT', body: JSON.stringify({
      name: 'Paused refit', priority: 'high', note: null, status: 'paused'
    }) })
    expect(updated.status).toBe(200)
    await expect(updated.json()).resolves.toMatchObject({ name: 'Paused refit', status: 'paused', priority: 'high' })
    expect(await api.getEngineeringMaterialWatchlist()).toMatchObject({ activeProjectCount: 0, materials: [] })
    const removedStep = await fetch(`${projectPath}/steps/${encodeURIComponent(planned.steps[0]!.id)}`, { method: 'DELETE' })
    expect(removedStep.status).toBe(200)
    await expect(removedStep.json()).resolves.toMatchObject({ steps: [] })
    const removed = await fetch(projectPath, { method: 'DELETE' })
    expect(removed.status).toBe(204)
    expect(await removed.text()).toBe('')
    expect((await api.getEngineeringProjects()).projects).toEqual([])
    expect((await fetch(projectPath, { method: 'DELETE' })).status).toBe(204)
  })
})

test('Engineering mutations still publish through the parent-owned browser stream', async () => {
  await withServer(async origin => {
    const controller = new AbortController()
    const response = await fetch(`${origin}/api/events`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
    try {
      await new PhoenixApiClient(origin).createEngineeringProject({ name: 'Event fixture', priority: 'normal', note: null })
      for await (const { event, data } of readSseEvents(response)) {
        if (event !== 'engineering-projects-changed') continue
        // Notification and project timestamps are separate clock reads, not an equality contract.
        expect(EngineeringProjectsChangedSchema.safeParse(JSON.parse(data)).success).toBe(true)
        break
      }
    } finally { controller.abort() }
  })
})

test('Engineering invalid request bodies do not mutate projects', async () => {
  await withServer(async origin => {
    const project = await new PhoenixApiClient(origin).createEngineeringProject({ name: 'Untouched', priority: 'normal', note: null })
    const before = await new PhoenixApiClient(origin).getEngineeringProjects()
    const mutations = [vi.spyOn(EngineeringProjectService.prototype, 'create'),
      vi.spyOn(EngineeringProjectService.prototype, 'update'), vi.spyOn(EngineeringProjectService.prototype, 'addStep')]
    try {
      for (const [path, method] of [['projects', 'POST'], [`projects/${project.id}`, 'PUT'], [`projects/${project.id}/steps`, 'POST']]) {
        for (const body of ['', '{', '{}', ' '.repeat(65537)]) {
          const response = await fetch(`${origin}/api/engineering/${path}`, { method, body })
          expect(response.status).toBe(400)
          await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_request', message: expect.any(String) } })
        }
      }
      for (const mutation of mutations) expect(mutation).not.toHaveBeenCalled()
      expect(await new PhoenixApiClient(origin).getEngineeringProjects()).toEqual(before)
    } finally { for (const mutation of mutations) mutation.mockRestore() }
  })
})

test('Engineering domain and storage exceptions retain the existing server-error mapping', async () => {
  await withServer(async origin => {
    const api = new PhoenixApiClient(origin)
    const project = await api.createEngineeringProject({ name: 'Failure fixture', priority: 'normal', note: null })
    const missing = await fetch(`${origin}/api/engineering/projects/${project.id}/steps`, { method: 'POST',
      body: JSON.stringify({ blueprintSymbol: 'unknown', targetGrade: 1, plannedRolls: 1 }) })
    expect(missing.status).toBe(500)
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'internal_error', message: 'Engineering blueprint unknown does not exist.' } })
    const save = vi.spyOn(EngineeringProjectService.prototype, 'create').mockImplementationOnce(() => { throw new Error('Synthetic persistence failure') })
    try {
      const failed = await fetch(`${origin}/api/engineering/projects`, { method: 'POST', body: '{"name":"Valid"}' })
      expect(failed.status).toBe(500)
      await expect(failed.json()).resolves.toMatchObject({ error: { code: 'internal_error', message: 'Synthetic persistence failure' } })
    } finally { save.mockRestore() }
    expect((await api.getEngineeringProjects()).projects).toEqual([project])
  })
})

test('Engineering unsupported methods and near-match paths fall through without claiming other routes', async () => {
  await withServer(async origin => {
    for (const [path, method] of [['engineers', 'POST'], ['projects/', 'GET'], ['projects-extra', 'POST'],
      ['projects/id/steps/', 'POST'], ['blueprints/symbol/extra', 'GET'], ['unknown', 'GET']]) {
      const response = await fetch(`${origin}/api/engineering/${path}`, { method })
      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
    }
    expect((await fetch(`${origin}/api/settings/general`)).status).toBe(200)
    expect((await fetch(`${origin}/api/health`)).status).toBe(200)
  })
})

test('pairing remains ahead of Engineering validation and mutation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-engineering-pairing-'))
  const accessControl = new PairingAccessController(join(directory, 'pairing.json'))
  try {
    await withServer(async origin => {
      const create = vi.spyOn(EngineeringProjectService.prototype, 'create')
      try {
        for (const [path, method] of [['projects', 'POST'], ['projects/id', 'PUT'], ['projects/id', 'DELETE'],
          ['projects/id/steps', 'POST'], ['projects/id/steps/step', 'DELETE'], ['materials', 'GET']]) {
          const response = await fetch(`${origin}/api/engineering/${path}`, { method, ...(method === 'GET' ? {} : { body: '{' }) })
          expect(response.status).toBe(401)
          await expect(response.json()).resolves.toMatchObject({ error: { code: 'pairing_required' } })
        }
        expect(create).not.toHaveBeenCalled()
        const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST', body: JSON.stringify({ code: accessControl.pairingCode }) })
        const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
        const response = await fetch(`${origin}/api/engineering/projects`, { method: 'POST', headers: { cookie }, body: '{"name":"Authorized"}' })
        expect(response.status).toBe(201)
        expect(create).toHaveBeenCalledOnce()
      } finally { create.mockRestore() }
    }, { accessControl })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
