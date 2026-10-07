import { fileURLToPath } from 'node:url'
import { expect, test, vi } from 'vitest'
import type { EngineeringProject } from '@phoenix/contracts'
import { JsonEngineeringCatalogue } from '@phoenix/elite'
import { EngineeringDataService } from '../apps/server/src/application/engineering-data-service.js'
import { EngineeringProjectService } from '../apps/server/src/application/engineering-project-service.js'
import { EngineeringGetProjectReportTool } from '../apps/server/src/application/mcp-tools/engineering-get-project-report-tool.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { CopilotToolRegistry } from '../apps/server/src/application/copilot-tool-registry.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

test('report aggregates blueprint rolls and effect applications across active projects, counting stock once', () => {
  const { service, stock } = fixture()
  const first = service.create({ name: 'Refit', priority: 'normal', note: 'Weapons first' })
  const second = service.create({ name: 'Backup', priority: 'high', note: null })
  service.addStep(first.id, { blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls: 4, note: null })
  service.addStep(second.id, { kind: 'experimental', effectSymbol: 'special_test', moduleId: 'mc', applications: 3, note: null })
  stock(5)

  const before = service.getAll()
  const report = service.getReport()
  expect(report).toMatchObject({
    inventoryAvailable: true, observedAt: '2026-10-07T12:00:00Z', personalEquipment: 'unsaved_preview_only',
    projects: [
      { id: first.id, note: 'Weapons first', steps: [{ kind: 'blueprint', blueprintName: 'Reinforced Test Module', targetGrade: 1, plannedRolls: 4 }] },
      { id: second.id, steps: [{ kind: 'experimental', effectName: 'Test effect', moduleNames: ['Multi-cannon'], moduleId: 'mc', applications: 3 }] }
    ],
    materials: [{ materialId: 'TestWidgets', required: 10, owned: 5, missing: 5, highestPriority: 'high', projectCount: 2, stepCount: 2 }]
  })
  expect(report.materials).toEqual(service.getMaterialWatchlist().materials)
  expect(report.projects[0]?.steps[0]).not.toHaveProperty('requirements')
  expect(service.getAll()).toEqual(before)
  stock(20)
  expect(service.getReport().materials).toMatchObject([{ required: 10, owned: 20, missing: 0 }])
  expect(service.getMaterialWatchlist().materials).toEqual([])
})

test('report distinguishes unobserved inventory from observed zero and follows fresh stock', () => {
  const { service, stock } = fixture()
  const project = service.create({ name: 'Refit', priority: 'normal', note: null })
  service.addStep(project.id, { blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls: 4, note: null })
  expect(service.getReport()).toMatchObject({ inventoryAvailable: false, observedAt: null,
    materials: [{ required: 4, owned: null, missing: null }] })
  stock(null)
  expect(service.getReport()).toMatchObject({ inventoryAvailable: true,
    materials: [{ required: 4, owned: 0, missing: 4 }] })
  stock(3)
  expect(service.getReport().materials).toMatchObject([{ owned: 3, missing: 1 }])
})

test('report excludes every inactive status but retains active projects without steps', () => {
  const { service } = fixture()
  for (const status of ['paused', 'completed', 'archived'] satisfies Array<EngineeringProject['status']>) {
    const project = service.create({ name: status, priority: 'normal', note: null })
    service.addStep(project.id, { blueprintSymbol: 'TestModule_Reinforced', targetGrade: 1, plannedRolls: 10, note: null })
    service.update(project.id, { name: project.name, priority: project.priority, note: project.note, status })
  }
  expect(service.getReport()).toMatchObject({ projects: [], materials: [] })
  const active = service.create({ name: 'Empty plan', priority: 'low', note: null })
  expect(service.getReport()).toMatchObject({ projects: [{ id: active.id, steps: [] }], materials: [] })
})

test('project report permission is separately listed and enforced for installation and active profile', async () => {
  const { service } = fixture()
  const getReport = vi.spyOn(service, 'getReport')
  const tool = new EngineeringGetProjectReportTool(service)
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(() => [tool.definition], {
    find: () => undefined, getCatalog: () => ({ schemaVersion: 1, commands: [] })
  }, settings)
  const registry = new CopilotToolRegistry([tool], capabilities)
  const id = 'tool:engineering.get_project_report'
  expect(capabilities.catalogue().groups).toMatchObject([{ id: 'tools.engineering', capabilities: [{ id, access: 'read' }] }])
  expect(tool.definition.annotations).toEqual({ readOnly: true })
  const profileId = settings.loadOrCreate().copilot.activeProfileId
  const call = { name: tool.definition.name, arguments: {}, id: 'report' }
  const context = { callId: 'report', signal: new AbortController().signal,
    deadline: new Date(Date.now() + 30_000).toISOString(), runId: 'project-report-test' }
  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: [id] })
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [] })
  expect(registry.definitions).toEqual([])
  await expect(registry.execute(call, context)).rejects.toThrow('disabled in Settings')
  expect(getReport).not.toHaveBeenCalled()
  capabilities.saveProfilePolicy(profileId, { version: 2, enabledCapabilityIds: [id] })
  expect(registry.definitions.map(definition => definition.name)).toEqual([tool.definition.name])
  await expect(registry.execute({ ...call, arguments: { status: 'archived' } }, context)).rejects.toThrow()
  expect(getReport).not.toHaveBeenCalled()
  await expect(registry.execute(call, context)).resolves.toMatchObject({ structuredContent: { projects: [], materials: [] } })
  expect(getReport).toHaveBeenCalledTimes(1)
  capabilities.saveInstallationPolicy({ version: 2, enabledCapabilityIds: [] })
  await expect(registry.execute(call, context)).rejects.toThrow('disabled in Settings')
  expect(getReport).toHaveBeenCalledTimes(1)
})

function fixture () {
  const path = (name: string) => fileURLToPath(new URL(`./fixtures/catalogue/engineering/${name}.json`, import.meta.url))
  const catalogue = new JsonEngineeringCatalogue({ blueprints: path('blueprints'), engineers: path('engineers'),
    materials: path('materials'), materialUses: path('material-uses'), experimentalEffects: path('experimental-effects') })
  const runtime = new InMemoryRuntimeStateStore()
  const projects = new Map<string, EngineeringProject>()
  const service = new EngineeringProjectService({
    getProject: id => projects.get(id) ?? null, listProjects: () => [...projects.values()],
    putProject: project => { projects.set(project.id, project) }, deleteProject: id => { projects.delete(id) }
  }, catalogue, new EngineeringDataService(catalogue, runtime), { publish () {}, subscribe: () => () => {} })
  return { service, stock: (count: number | null) => {
    const state = runtime.getCurrent()
    runtime.replace({ ...state, inventory: { ...state.inventory, materials: {
      updatedAt: '2026-10-07T12:00:00Z', raw: [], encoded: [],
      manufactured: count === null ? [] : [{ id: 'TestWidgets', label: 'Test Widgets', count }]
    } } })
  } }
}
