// Coriolis module-group identifiers. Missile suffixes are upstream seeker/dumbfire mappings.
const moduleNames = {
  bh: 'Bulkheads', bl: 'Beam Laser', bsg: 'Bi-Weave Shield Generator', c: 'Cannon',
  fc: 'Fragment Cannon', fsd: 'Frame Shift Drive', hr: 'Hull Reinforcement Package',
  mc: 'Multi-cannon', advmc: 'Advanced Multi-cannon', mr: 'Missile Rack',
  amr: 'Advanced Missile Rack', nl: 'Mine Launcher', pa: 'Plasma Accelerator',
  pd: 'Power Distributor', pl: 'Pulse Laser', pp: 'Power Plant',
  psg: 'Prismatic Shield Generator', rg: 'Rail Gun', sb: 'Shield Booster',
  scb: 'Shield Cell Bank', sg: 'Shield Generator', t: 'Thrusters',
  tp: 'Torpedo Pylon', ul: 'Burst Laser'
}

export function buildExperimentalEffects(specials, modules, materials, source) {
  const materialNames = new Map(materials.map(material => [material.name.trim(), material.name]))
  const effects = new Map()
  for (const [groupId, group] of Object.entries(modules)) {
    for (const field of ['specials', 'specials_D', 'specials_S']) {
      for (const symbol of group[field] ?? []) {
        const definition = specials[symbol]
        if (!definition) throw new Error(`Missing experimental effect: ${symbol}`)
        if (/legacy/i.test(definition.name)) continue
        // Unverified legacy-era recipe: do not advertise it as a plannable effect.
        if (symbol === 'special_ion_disruptor') continue
        if (!definition.components || !Object.keys(definition.components).length) continue
        const recipe = { ...definition.components }
        // Audited against Inara, 2026-09-27. See experimental-effects.md.
        const corrections = {
          special_armour_explosive: { Niobium: [3, 1] },
          special_weapon_lightweight: { Carbon: [3, 5] },
          special_shield_regenerative: { 'Compound Shielding': [3, 1] },
          special_shield_kinetic: { 'Flawed Focus Crystals': [5, 3] },
          special_drag_munitions: { Molybdenum: [5, 2] },
          special_screening_shell: { Niobium: [2, 3] }
        }
        for (const [name, [oldCost, cost]] of Object.entries(corrections[symbol] ?? {})) {
          if (recipe[name] === oldCost) recipe[name] = cost
          else if (recipe[name] !== cost) throw new Error(`Experimental recipe needs re-audit: ${symbol}, ${name}`)
        }
        if (symbol === 'special_thermal_vent') {
          if (recipe['Conductive Components'] === 3 && recipe['Conductive Polymers'] === undefined) {
            delete recipe['Conductive Components']
            recipe['Conductive Polymers'] = 3
          } else if (recipe['Conductive Components'] !== undefined || recipe['Conductive Polymers'] !== 3) {
            throw new Error(`Experimental recipe needs re-audit: ${symbol}`)
          }
        }
        if (symbol === 'special_blinding_shell') {
          if (recipe['Mechanical Components'] === undefined) recipe['Mechanical Components'] = 5
          else if (recipe['Mechanical Components'] !== 5) throw new Error(`Experimental recipe needs re-audit: ${symbol}`)
        }
        if (symbol === 'special_blinding_shell' && recipe['Mechanical Components'] === undefined) recipe['Mechanical Components'] = 5
        const components = Object.entries(recipe).map(([name, cost]) => [
          materialNames.get(name.trim().replace('Encyptors', 'Encryptors')) ?? name, cost
        ])
        if (!components.length) continue // Unknown recipe is never zero cost.
        if (!moduleNames[groupId]) throw new Error(`Unknown experimental module group: ${groupId}`)
        for (const [name, cost] of components) {
          if (!materialNames.has(name.trim()) || !Number.isInteger(cost) || cost < 1) {
            throw new Error(`Invalid experimental recipe: ${symbol}, ${name}`)
          }
        }
        const moduleId = field === 'specials' ? groupId : `${groupId}:${field.slice(-1)}`
        const moduleName = moduleNames[groupId] + (field === 'specials_D' ? ' (Dumbfire)' : field === 'specials_S' ? ' (Seeker)' : '')
        const effect = effects.get(symbol) ?? {
          symbol, name: definition.name, description: definition.description ?? '',
          modules: [], components: components.map(([name, cost]) => ({ name, cost }))
        }
        if (!effect.modules.some(module => module.id === moduleId)) effect.modules.push({ id: moduleId, name: moduleName })
        effects.set(symbol, effect)
      }
    }
  }
  return {
    schemaVersion: 1,
    source,
    recipeAudit: { url: 'https://inara.cz/elite/experimentaleffects/', date: '2026-09-27', corrections: 'scripts/catalogue/experimental-effects.md' },
    effects: [...effects.values()].sort((a, b) => a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol))
  }
}
