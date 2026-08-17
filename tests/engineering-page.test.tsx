import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { EngineeringBlueprintDetail, EngineeringEngineer, EngineeringMaterial } from '@phoenix/contracts'
import { EngineeringPage } from '../apps/web/src/features/engineering/engineering-page.js'
import { engineeringNavigationItems } from '../apps/web/src/features/engineering/engineering-navigation.js'

test('Engineering exposes the archived six-view information architecture through typed routes', () => {
  expect(engineeringNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Blueprints', '#/engineering/blueprints'], ['Engineers', '#/engineering/engineers'],
    ['Raw materials', '#/engineering/materials/raw'], ['Manufactured materials', '#/engineering/materials/manufactured'],
    ['Encoded materials', '#/engineering/materials/encoded'], ['Xeno materials', '#/engineering/materials/xeno']
  ])
})

test('Blueprint catalogue is independent from current-ship application and keeps typed detail links', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ blueprints: { blueprints: [
    { appliedModuleCount: 1, moduleNames: ['Thrusters'], name: 'Dirty drive tuning', originalName: 'DirtyDrive', symbol: 'dirty-drive' },
    { appliedModuleCount: 0, moduleNames: ['Power Plant'], name: 'Overcharged', originalName: 'OverchargedPowerPlant', symbol: 'overcharged' }
  ] }, status: 'ready' }} view="blueprints" />)
  expect(markup).not.toContain('Applied blueprints')
  expect(markup).not.toContain('Current ship')
  expect(markup).toContain('#/engineering/blueprints?symbol=dirty-drive')
  expect(markup).not.toContain('1 fitted')
})

test('Engineer tables retain access grouping and system navigation', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ engineers: { engineers: [engineer()] }, status: 'ready' }} view="engineers" />)
  expect(markup).toContain('Unlocked engineers')
  expect(markup).toContain('Known / invited engineers')
  expect(markup).toContain('Locked engineers')
  expect(markup).toContain('#/galaxy/system?name=Deciat')
  expect(markup).toContain('Grade 5')
})

test('Material tables retain groups, inventory, applications, and grade', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ materials: { materials: [material()], updatedAt: '2026-08-17T00:00:00.000Z' }, status: 'ready' }} view="materials-raw" />)
  expect(markup).toContain('Raw elements')
  expect(markup).toContain('Iron')
  expect(markup).toContain('10 / 300')
  expect(markup).toContain('Lightweight armour')
  expect(markup).toContain('G1')
})

test('Blueprint detail retains fitted modules, engineers, effects, and material stock', () => {
  const markup = renderToStaticMarkup(<EngineeringPage controller={{ blueprint: blueprint(), status: 'ready' }} selectedBlueprintSymbol="dirty-drive" view="blueprints" />)
  expect(markup).toContain('Engineered equipment')
  expect(markup).toContain('Felicity Farseer')
  expect(markup).toContain('Optimal mass')
  expect(markup).toContain('Chemical Manipulators')
  expect(markup).toContain('Grade 5')
})

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
