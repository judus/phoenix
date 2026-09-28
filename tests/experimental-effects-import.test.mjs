import { expect, test } from 'vitest'
import { buildExperimentalEffects } from '../scripts/catalogue/build-experimental-effects.mjs'

const materials = [{ name: 'Iron' }, { name: 'Adaptive Encryptors Capture' }]
const source = { revision: 'fixture' }
test('effect identity and missile variants remain explicit; incomplete and legacy recipes are excluded', () => {
  const catalogue = buildExperimentalEffects({
    a: { name: 'Shared name', components: { Iron: 2 } },
    b: { name: 'Shared name', components: { Iron: 3 } },
    legacy: { name: 'Legacy effect', components: { Iron: 1 } },
    unknown: { name: 'Unknown recipe' }
  }, { mr: { specials_D: ['a', 'legacy', 'unknown'], specials_S: ['b'] }, mc: { specials: ['a'] } }, materials, source)
  expect(catalogue.effects).toEqual([
    expect.objectContaining({ symbol: 'a', components: [{ name: 'Iron', cost: 2 }], modules: [
      { id: 'mr:D', name: 'Missile Rack (Dumbfire)' }, { id: 'mc', name: 'Multi-cannon' }
    ] }),
    expect.objectContaining({ symbol: 'b', components: [{ name: 'Iron', cost: 3 }], modules: [
      { id: 'mr:S', name: 'Missile Rack (Seeker)' }
    ] })
  ])
})
test('invalid recipe quantities, material identities and compatibility groups fail closed', () => {
  for (const components of [{ Iron: 0 }, { Iron: 1.5 }, { Unobtainium: 1 }]) {
    expect(() => buildExperimentalEffects({ a: { name: 'A', components } }, { mc: { specials: ['a'] } }, materials, source)).toThrow('Invalid experimental recipe')
  }
  expect(() => buildExperimentalEffects({ a: { name: 'A', components: { Iron: 1 } } }, { unknown: { specials: ['a'] } }, materials, source)).toThrow('Unknown experimental module')
  expect(() => buildExperimentalEffects({}, { mc: { specials: ['missing'] } }, materials, source)).toThrow('Missing experimental effect')
})
test('upstream spelling and material whitespace resolve to canonical material names', () => {
  const result = buildExperimentalEffects({ a: { name: 'A', components: { 'Adaptive Encyptors Capture': 1, Iron: 2 } } }, { mc: { specials: ['a'] } }, [...materials.slice(1), { name: 'Iron ' }], source)
  expect(result.effects[0].components).toEqual([{ name: 'Adaptive Encryptors Capture', cost: 1 }, { name: 'Iron ', cost: 2 }])
})
test('audited corrections are explicit and unexpected cost drift requires review', () => {
  const build = cost => buildExperimentalEffects({ special_weapon_lightweight: { name: 'Stripped Down', components: { Carbon: cost } } }, { mc: { specials: ['special_weapon_lightweight'] } }, [{ name: 'Carbon' }], source)
  expect(build(3).effects[0].components).toEqual([{ name: 'Carbon', cost: 5 }])
  expect(build(5).effects[0].components).toEqual([{ name: 'Carbon', cost: 5 }])
  expect(() => build(4)).toThrow('needs re-audit')
})
