import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { JsonEngineeringCatalogue } from '../packages/elite/src/engineering/json-engineering-catalogue.js'
import { EngineeringDataService } from '../apps/server/src/application/engineering-data-service.js'

const directory = fileURLToPath(new URL('./fixtures/catalogue/engineering/', import.meta.url))
const recipe = (cost: number) => ({ components: { 'Test Widgets': cost }, features: {} })

function withCatalogue(grades: Record<string, ReturnType<typeof recipe>>, check: (catalogue: JsonEngineeringCatalogue) => void): void {
  const temporary = mkdtempSync(join(tmpdir(), 'phoenix-grade-compatibility-'))
  try {
    const records = JSON.parse(readFileSync(join(directory, 'blueprints.json'), 'utf8'))
    records[0].grades = grades
    const blueprints = join(temporary, 'blueprints.json')
    writeFileSync(blueprints, JSON.stringify(records))
    check(new JsonEngineeringCatalogue({
      blueprints,
      engineers: join(directory, 'engineers.json'),
      materials: join(directory, 'materials.json'),
      materialUses: join(directory, 'material-uses.json')
    }))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

test.each(['01', '1suffix', '1.5', ' 1', '+1'])('retained grade key %j keeps its existing parseInt interpretation', key => {
  withCatalogue({ [key]: recipe(2) }, catalogue => {
    const data = new EngineeringDataService(catalogue, { getCurrent: () => createEmptyRuntimeState() })
    expect(data.getBlueprint('TestModule_Reinforced')?.grades).toMatchObject([
      { grade: 1, components: [{ name: 'Test Widgets', cost: 2 }] }
    ])
  })
})

test('retained aliases do not overwrite recipes and preserve first-match ordering', () => {
  withCatalogue({ '01': recipe(2), '1suffix': recipe(3), '1': recipe(1) }, catalogue => {
    const grades = catalogue.getBlueprint('TestModule_Reinforced')!.grades
    expect(grades.map(grade => [grade.grade, grade.components[0]!.cost])).toEqual([[1, 1], [1, 2], [1, 3]])
    expect(grades.find(grade => grade.grade === 1)?.components[0]?.cost).toBe(1)
  })
})

test('retained sparse, empty and future positive grade maps keep their accepted reader contract', () => {
  for (const [grades, expected] of [
    [{ '5': recipe(5), '1': recipe(1) }, [1, 5]],
    [{}, []],
    [{ '6': recipe(6) }, [6]]
  ] as const) {
    withCatalogue(grades, catalogue => {
      const data = new EngineeringDataService(catalogue, { getCurrent: () => createEmptyRuntimeState() })
      expect(data.getBlueprint('TestModule_Reinforced')?.grades.map(grade => grade.grade)).toEqual(expected)
    })
  }
})

test.each(['0', '-1', 'invalid', ''])('retained key %j still loads but its invalid normalized grade fails at the public detail boundary', key => {
  withCatalogue({ [key]: recipe(1) }, catalogue => {
    expect(catalogue.getBlueprint('TestModule_Reinforced')?.grades).toHaveLength(1)
    const data = new EngineeringDataService(catalogue, { getCurrent: () => createEmptyRuntimeState() })
    expect(() => data.getBlueprint('TestModule_Reinforced')).toThrow()
  })
})
