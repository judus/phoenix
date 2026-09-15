import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { EngineeringBlueprintDetail, EngineeringEngineer, EngineeringMaterial } from '@phoenix/contracts'
import { EngineeringPage } from '../apps/web/src/features/engineering/engineering-page.js'
import { engineeringNavigationItems } from '../apps/web/src/features/engineering/engineering-navigation.js'

const onNavigate = () => undefined

test('Engineering exposes project planning and catalogue views through typed routes', () => {
  expect(engineeringNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Projects', '#/engineering/projects'], ['Blueprints', '#/engineering/blueprints'], ['Engineers', '#/engineering/engineers'],
    ['Raw materials', '#/engineering/materials/raw'], ['Manufactured materials', '#/engineering/materials/manufactured'],
    ['Encoded materials', '#/engineering/materials/encoded'], ['Xeno materials', '#/engineering/materials/xeno']
  ])
})

test('Blueprint catalogue is independent from current-ship application and keeps typed detail links', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ blueprints: { blueprints: [
    { appliedModuleCount: 1, moduleNames: ['Thrusters'], name: 'Dirty drive tuning', originalName: 'DirtyDrive', symbol: 'dirty-drive' },
    { appliedModuleCount: 0, moduleNames: ['Power Plant'], name: 'Overcharged', originalName: 'OverchargedPowerPlant', symbol: 'overcharged' }
  ] }, status: 'ready' }} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'blueprints' }} />)
  expect(markup).not.toContain('Applied blueprints')
  expect(markup).not.toContain('Current ship')
  expect(markup).toContain('#/engineering/blueprints?symbol=dirty-drive')
  expect(markup).not.toContain('1 fitted')
})

test('Engineering project index summarizes plans and links to dedicated project details', () => {
  const projectId = '00000000-0000-4000-8000-000000000001'
  const project = engineeringProject(projectId)
  const markup = renderToStaticMarkup(<EngineeringPage controller={{
    projects: { schemaVersion: 1, projects: [project] },
    status: 'ready',
    watchlist: { activeProjectCount: 1, materials: [{ category: 'raw', grade: 2, highestPriority: 'high', materialId: 'Arsenic', materialName: 'Arsenic', missing: 4, owned: 2, projectCount: 1, projects: [{ id: projectId, name: 'Explorer refit' }], required: 6, stepCount: 1 }], observedAt: '2026-09-13T12:00:00Z', schemaVersion: 1
  }}} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'projects' }} />)
  expect(markup).toContain('Explorer refit')
  expect(markup).toContain(`#/engineering/projects/${projectId}`)
  expect(markup).toContain('4 units')
  expect(markup).toContain('1 material')
  expect(markup).not.toContain('Long Range FSD')
  expect(markup).toContain('New project')
})

test('Engineering project detail owns settings, blueprint steps, and its material plan', () => {
  const projectId = '00000000-0000-4000-8000-000000000001'
  const markup = renderToStaticMarkup(<EngineeringPage controller={{
    projects: { schemaVersion: 1, projects: [engineeringProject(projectId)] },
    status: 'ready',
    watchlist: { activeProjectCount: 1, materials: [{ category: 'raw', grade: 2, highestPriority: 'high', materialId: 'Arsenic', materialName: 'Arsenic', missing: 4, owned: 2, projectCount: 1, projects: [{ id: projectId, name: 'Explorer refit' }], required: 6, stepCount: 1 }], observedAt: '2026-09-13T12:00:00Z', schemaVersion: 1
  }}} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'project-detail', selectedProjectId: projectId }} />)
  expect(markup).toContain('Project settings')
  expect(markup).toContain('Long Range FSD')
  expect(markup).toContain('Project material plan')
  expect(markup).toContain('<td>6</td><td class="text-danger">4</td>')
})

test('Engineer tables retain access grouping and system navigation', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ engineers: { engineers: [engineer()] }, status: 'ready' }} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'engineers' }} />)
  expect(markup).toContain('Unlocked engineers')
  expect(markup).toContain('Known / invited engineers')
  expect(markup).toContain('Locked engineers')
  expect(markup).toContain('#/galaxy/system?name=Deciat')
  expect(markup).toContain('Grade 5')
})

test('Material tables retain groups, inventory, applications, and grade', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ materials: { materials: [material()], updatedAt: '2026-08-17T00:00:00.000Z' }, status: 'ready' }} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'materials-raw' }} />)
  expect(markup).toContain('Raw elements')
  expect(markup).toContain('Iron')
  expect(markup).toContain('10 / 300')
  expect(markup).toContain('Lightweight armour')
  expect(markup).toContain('G1')
  expect(markup).toContain('class="data-table compact surface material-table"')
  expect(markup).toContain('<th class="numeric">Inventory</th>')
  expect(markup).toContain('<col class="applications-column"/>')
})

test('Blueprint detail retains fitted modules, engineers, effects, and material stock', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ blueprint: blueprint(), status: 'ready' }} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'blueprints', selectedBlueprintSymbol: 'dirty-drive' }} />)
  expect(markup).toContain('Engineered equipment')
  expect(markup).toContain('Felicity Farseer')
  expect(markup).toContain('Optimal mass')
  expect(markup).toContain('Chemical Manipulators')
  expect(markup).toContain('Grade 5')
  expect(markup).toContain('Add to project')
  expect(markup).not.toContain('id="blueprint-project"')
})

test('Adding a blueprint uses a dedicated project-step screen', () => {
  const projectId = '00000000-0000-4000-8000-000000000001'
  const markup = renderToStaticMarkup(<EngineeringPage controller={{
    blueprint: blueprint(),
    projects: { projects: [engineeringProject(projectId)], schemaVersion: 1 },
    status: 'ready'
  }} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'project-add-blueprint', selectedBlueprintSymbol: 'dirty-drive', selectedProjectId: projectId }} />)
  expect(markup).toContain('Project step')
  expect(markup).toContain('Explorer refit')
  expect(markup).toContain('Target grade')
  expect(markup).toContain('Planned rolls')
  expect(markup).toContain('Add blueprint')
})

function engineeringProject(id: string) {
  return {
    createdAt: '2026-09-13T12:00:00Z', id, name: 'Explorer refit', note: null, priority: 'high' as const, schemaVersion: 1 as const,
    status: 'active' as const, updatedAt: '2026-09-13T12:00:00Z', steps: [{
      blueprintName: 'Long Range FSD', blueprintSymbol: 'FSD_LongRange', createdAt: '2026-09-13T12:00:00Z', id: '00000000-0000-4000-8000-000000000002',
      kind: 'blueprint' as const, moduleNames: ['Frame shift drive'], note: null, plannedRolls: 6, targetGrade: 5,
      requirements: [{ category: 'raw' as const, grade: 2, materialId: 'Arsenic', materialName: 'Arsenic', required: 6, unitCost: 1 }]
    }]
  }
}

function engineer(): EngineeringEngineer {
  return { description: 'Frame Shift Drives', distanceLy: 42, id: 1, marketId: 128666762, name: 'Felicity Farseer', progress: { rank: 5, rankProgress: 100, status: 'Unlocked' }, state: 'unlocked', system: { address: 1, name: 'Deciat', position: [0, 0, 0] } }
}

function material(): EngineeringMaterial {
  return { blueprintUses: [{ grades: [1], name: 'Lightweight armour', symbol: 'lightweight-armour' }], category: 'raw', count: 10, grade: 1, group: 'Raw elements', id: 'iron', maxCount: 300, name: 'Iron', rarity: 'Very common' }
}

function blueprint(): EngineeringBlueprintDetail {
  return {
    appliedModuleCount: 1,
    appliedModules: [{ experimentalEffect: 'Drag Drives', grade: 5, name: 'Thrusters', slotId: 'MainEngines' }],
    engineers: [{ distanceLy: 42, grades: [1, 2, 3, 4, 5], name: 'Felicity Farseer', rank: 5, status: 'Unlocked', systemName: 'Deciat' }],
    grades: [{ components: [{ category: 'manufactured', cost: 1, count: 4, grade: 3, id: 'chemical-manipulators', name: 'Chemical Manipulators' }], features: [{ improvement: true, name: 'Optimal mass', type: null, values: [4, 8] }], grade: 5 }],
    moduleNames: ['Thrusters'], name: 'Dirty drive tuning', originalName: 'DirtyDrive', symbol: 'dirty-drive'
  }
}
