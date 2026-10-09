import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const styles = resolve(import.meta.dirname, '../packages/ui/src/styles')
const read = (path: string) => readFileSync(resolve(styles, path), 'utf8')

test('workspace touch policy reaches nested scrolling surfaces without overriding map/edit owners', () => {
  const source = read('app-shell.css')
  expect(source).toContain(':where(.deskplane-swipe-zone *) { touch-action: inherit; }')
  expect(source).toContain(':where(.deskplane-swipe-zone [data-deskplane-no-swipe]) { touch-action: auto; }')
  expect(read('pages/galactic-atlas.css')).toContain('touch-action: none')
  expect(read('pages/controls.css')).toContain('touch-action: none')
})

test('schematic background layers belong to the map surface, not the layout containing its sidebar gap', () => {
  const source = read('pages/system-schematic.css')
  const layout = source.match(/\.system-cartography\s*\{([^}]+)/u)?.[1]
  const map = source.match(/\.system-schematic\s*\{([^}]+)/u)?.[1]
  expect(layout).not.toMatch(/background(?:-color|-image)?\s*:/u)
  expect(layout).toContain('container-type: size')
  expect(map).toContain('linear-gradient(')
  expect(map).toContain('radial-gradient(')
  expect(map).toContain('var(--color-surface)')
  expect(map).toContain('100cqw 100cqh')
  expect(map).toContain('background-repeat: repeat, repeat, no-repeat')
})

test('inputs and selects share their field surface rather than inheriting dropdown-wrapper styles', () => {
  const source = read('base/forms.css')
  const fields = source.match(/\.form-control\s*,\s*\.form-select\s*\{([^}]+)/u)?.[1]
  expect(fields).toContain('inline-size: 100%')
  expect(fields).toContain('min-block-size: var(--control-block-size)')
  expect(fields).toContain('border: var(--control-border-width) solid var(--field-border)')
  expect(fields).toContain('background: var(--field-background)')
  expect(source).not.toMatch(/\.form-control\s*,\s*\.select-control/u)
})

test('shared fields keep an inset keyboard focus ring separate from invalid borders', () => {
  const source = read('base/forms.css')
  const focus = source.match(/&:focus-visible\s*\{([^}]+)\}/u)?.[1]
  expect(focus).toContain('outline: 2px solid var(--color-focus)')
  expect(focus).toContain('outline-offset: -4px')
  expect(source).toMatch(/&\.invalid :is\(\.form-control, \.form-select\)\s*\{\s*border-color: var\(--color-danger\)/u)
})

test('Elite tiles retain a flat inset focus frame instead of suppressing focus', () => {
  const source = read('patterns/tile-groups.css')
  const focus = source.match(/&:focus-visible\s*\{([^}]+)\}/u)?.[1]
  expect(focus).toContain('outline: 2px solid var(--color-focus)')
  expect(focus).toContain('outline-offset: -4px')
  expect(focus).toContain('box-shadow: inset 0 0 0 4px var(--color-canvas)')
})

test('the shared cascade imports each stylesheet once', () => {
  const imports = [...read('main.css').matchAll(/@import '([^']+)'/gu)].map(match => match[1])
  expect(imports.length).toBeGreaterThan(0)
  expect(new Set(imports).size).toBe(imports.length)
})

test('watermark weights use declared tokens', () => {
  const declared = new Set([...read('variable.css').matchAll(/(--font-weight-[\w-]+):/gu)].map(match => match[1]))
  const references = [...read('patterns/control-deck-tiles.css').matchAll(/var\((--font-weight-[\w-]+)\)/gu)].map(match => match[1])
  expect(references.length).toBeGreaterThan(0)
  expect(references.filter(token => !declared.has(token))).toEqual([])
})
