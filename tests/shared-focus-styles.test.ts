import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const styles = resolve(import.meta.dirname, '../packages/ui/src/styles')
const read = (path: string) => readFileSync(resolve(styles, path), 'utf8')

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
  expect(new Set(imports).size).toBe(imports.length)
})

test('watermark weights use declared tokens', () => {
  const declared = new Set([...read('variable.css').matchAll(/(--font-weight-[\w-]+):/gu)].map(match => match[1]))
  const references = [...read('patterns/control-deck-tiles.css').matchAll(/var\((--font-weight-[\w-]+)\)/gu)].map(match => match[1])
  expect(references.filter(token => !declared.has(token))).toEqual([])
})
