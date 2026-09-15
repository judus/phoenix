import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  JsonPersonalEquipmentCatalogue,
  PersonalEquipmentPlanningError,
  planPersonalEquipmentUpgrade
} from '@phoenix/elite'

const catalogue = new JsonPersonalEquipmentCatalogue(join(process.cwd(), 'resources/catalogue/personal-equipment.json')).getSnapshot()

describe('personal equipment planner', () => {
  test('plans a Maverick from grade 1 to grade 5 with three modifications', () => {
    const plan = planPersonalEquipmentUpgrade(catalogue, {
      equipmentId: 'utilitysuit',
      currentGrade: 1,
      targetGrade: 5,
      installedModificationIds: [],
      installedModificationCount: 0,
      plannedModificationIds: ['suit_improvedradar', 'suit_backpackcapacity', 'suit_nightvision']
    })

    expect(plan.steps.map(step => step.kind)).toEqual([
      'grade_upgrade', 'grade_upgrade', 'grade_upgrade', 'grade_upgrade',
      'install_modification', 'install_modification', 'install_modification'
    ])
    expect(plan.slots).toEqual({ current: 0, target: 4, installed: 0, planned: 3, remaining: 1 })
    expect(materials(plan)).toMatchObject({
      carbonfibreplating: 28,
      graphene: 28,
      healthmonitor: 12,
      manufacturinginstructions: 12,
      suitschematic: 12,
      topographicalsurveys: 5,
      weaponinventory: 5,
      surveillanceequipment: 5
    })
  })

  test('plans the audited Karma P-15 grade path and kinetic range modification', () => {
    const plan = planPersonalEquipmentUpgrade(catalogue, {
      equipmentId: 'wpn_s_pistol_kinetic_sauto',
      currentGrade: 1,
      targetGrade: 5,
      installedModificationIds: [],
      installedModificationCount: 0,
      plannedModificationIds: ['weapon_range_kinetic']
    })

    expect(materials(plan)).toEqual({
      ballisticsdata: 10,
      compressionliquefiedgas: 12,
      manufacturinginstructions: 12,
      metalcoil: 10,
      rdx: 10,
      topographicalsurveys: 10,
      tungstencarbide: 28,
      weaponcomponent: 33,
      weaponschematic: 12
    })
  })

  test('plans only future work for an already upgraded and modified item', () => {
    const plan = planPersonalEquipmentUpgrade(catalogue, {
      equipmentId: 'utilitysuit',
      currentGrade: 3,
      targetGrade: 5,
      installedModificationIds: ['suit_improvedradar'],
      installedModificationCount: 1,
      plannedModificationIds: ['suit_backpackcapacity', 'suit_nightvision']
    })

    expect(plan.steps.slice(0, 2).map(step => step.id)).toEqual([
      'grade:suit:utilitysuit:3-4',
      'grade:suit:utilitysuit:4-5'
    ])
    expect(plan.steps.some(step => step.id === 'modification:suit_improvedradar')).toBe(false)
    expect(plan.slots).toEqual({ current: 2, target: 4, installed: 1, planned: 2, remaining: 1 })
    expect(materials(plan)).toMatchObject({ carbonfibreplating: 21, suitschematic: 9 })
  })

  test('rejects incompatible, duplicate, already-installed and overflowing modifications', () => {
    const base = {
      equipmentId: 'wpn_s_pistol_kinetic_sauto',
      currentGrade: 1,
      targetGrade: 5,
      installedModificationIds: [] as string[],
      installedModificationCount: 0,
      plannedModificationIds: [] as string[]
    }
    expect(() => planPersonalEquipmentUpgrade(catalogue, {
      ...base,
      plannedModificationIds: ['weapon_range_laser']
    })).toThrow(PersonalEquipmentPlanningError)
    expect(() => planPersonalEquipmentUpgrade(catalogue, {
      ...base,
      plannedModificationIds: ['weapon_range_kinetic', 'weapon_range_kinetic']
    })).toThrow('Duplicate planned modifications')
    expect(() => planPersonalEquipmentUpgrade(catalogue, {
      ...base,
      installedModificationIds: ['weapon_range_kinetic'],
      installedModificationCount: 1,
      plannedModificationIds: ['weapon_range_kinetic']
    })).toThrow('already installed')
    expect(() => planPersonalEquipmentUpgrade(catalogue, {
      ...base,
      targetGrade: 2,
      plannedModificationIds: ['weapon_range_kinetic', 'weapon_reloadspeed']
    })).toThrow('would be occupied')
  })
})

function materials (plan: ReturnType<typeof planPersonalEquipmentUpgrade>): Record<string, number> {
  return Object.fromEntries(plan.materials.map(material => [material.materialId, material.count]))
}
