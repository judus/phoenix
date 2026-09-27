import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type EngineeringProject } from '@phoenix/contracts'
import { JsonEngineeringCatalogue } from '../packages/elite/src/engineering/json-engineering-catalogue.js'
import { EngineeringProjectService } from '../apps/server/src/application/engineering-project-service.js'
import { EngineeringDataService } from '../apps/server/src/application/engineering-data-service.js'

function catalogue() {
  const path = (name: string) => fileURLToPath(new URL(name, import.meta.url))
  return new JsonEngineeringCatalogue({
    blueprints: path('./fixtures/blueprint-symbol-collision.json'),
    engineers: path('./fixtures/catalogue/engineering/engineers.json'),
    materials: path('./fixtures/catalogue/engineering/materials.json'),
    materialUses: path('./fixtures/catalogue/engineering/material-uses.json')
  })
}

test('canonical blueprint symbols take precedence over another blueprint internal name', () => {
  const source = catalogue()
  expect(source.getBlueprint('Weapon_Overcharged')).toMatchObject({ symbol: 'Weapon_Overcharged', displayName: 'Overcharged Weapon' })
  expect(source.getBlueprint(' weapon_overcharged ')).toMatchObject({ symbol: 'Weapon_Overcharged' })
  expect(source.getBlueprint('MC_Overcharged')).toMatchObject({ symbol: 'MC_Overcharged', displayName: 'Overcharged MC' })
  expect(source.getBlueprint('Legacy_Reinforced')).toMatchObject({ symbol: 'TestModule_Reinforced' })
  expect(source.getBlueprint('unknown')).toBeNull()
})

test('adding Overcharged Weapon preserves its identity and recipe in the project', () => {
  const source = catalogue()
  const projects = new Map<string, EngineeringProject>()
  const data = new EngineeringDataService(source, { getCurrent: () => createEmptyRuntimeState() })
  const service = new EngineeringProjectService({
    getProject: id => projects.get(id) ?? null,
    listProjects: () => [...projects.values()],
    putProject: project => { projects.set(project.id, project) },
    deleteProject: id => { projects.delete(id) }
  }, source, data, { publish() {}, subscribe: () => () => {} })
  expect(data.getBlueprint('Weapon_Overcharged')).toMatchObject({ symbol: 'Weapon_Overcharged', name: 'Overcharged Weapon' })
  const project = service.create({ name: 'Weapon refit', note: null, priority: 'normal' })
  const updated = service.addStep(project.id, {
    blueprintSymbol: 'Weapon_Overcharged', targetGrade: 1, plannedRolls: 3, note: null
  })
  expect(updated.steps[0]).toMatchObject({
    blueprintSymbol: 'Weapon_Overcharged', blueprintName: 'Overcharged Weapon',
    requirements: [{ unitCost: 2, required: 6 }]
  })
  expect(projects.get(project.id)?.steps[0]).toEqual(updated.steps[0])
})
