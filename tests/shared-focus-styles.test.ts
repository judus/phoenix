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

test('shared toggles use orange idle and blue selected styling without overriding momentary press feedback', () => {
  const buttons = read('base/buttons.css')
  const toggle = buttons.split('.btn-toggle {')[1]!.split('.btn.inset {')[0]!
  expect(toggle).toContain('border-color: var(--color-action)')
  expect(toggle).toContain('color: var(--color-action)')
  expect(toggle).toContain('&.active:not(:active)')
  expect(buttons).toContain('background: var(--color-pressed-background)')
  expect(buttons).toContain('color: var(--color-pressed-text)')
  expect(buttons.match(/&:active:not\(:disabled\)\s*\{([^}]+)/u)?.[1]).toContain('transition: none')
  expect(read('pages/system-schematic.css')).not.toContain('.system-query__toggle.btn')
})

test('ordinary buttons have no tactile grip; command tiles own the grip', () => {
  expect(read('base/buttons.css')).not.toContain('tactile-grip.svg')
  expect(read('patterns/control-deck-tiles.css')).toContain("mask: url('../../assets/tactile-grip.svg')")
  const variables = read('variable.css')
  expect(variables).toContain('--button-secondary-background: transparent')
  expect(variables).toContain('--button-primary-background: var(--color-action)')
})

test('danger indicators use red in both themes, independently of investigation magenta', () => {
  const variables = read('variable.css')
  expect(variables).toContain('--palette-red: #ff6258')
  expect([...variables.matchAll(/--color-danger: var\(--palette-red\)/gu)]).toHaveLength(2)
  expect(variables).not.toContain('--color-danger: var(--palette-coral)')
  expect(variables).toContain('--color-investigation: var(--palette-magenta)')
  expect(variables).toContain('--button-danger-background: var(--color-danger-surface)')
  expect([...variables.matchAll(/--button-danger-border: color-mix\(in srgb, var\(--color-danger\) 48%, transparent\)/gu)]).toHaveLength(2)
  expect(variables).toContain('--button-danger-text: var(--color-text)')
  const editorDelete = read('pages/controls.css').match(/&\.tool-delete\s*\{([^}]+)/u)?.[1]
  expect(editorDelete).toContain('border-color: var(--button-danger-border)')
  expect(editorDelete).toContain('color: var(--button-danger-text)')
  expect(editorDelete).toContain('background: var(--button-danger-background)')
})

test('deck-manager grip uses the filled input label colour and height without its own button treatment', () => {
  const grip = read('pages/controls.css').split('.deck-grip {')[1]!.split('.deck-confirm')[0]!
  expect(grip).toContain('block-size: var(--control-block-size)')
  expect(grip).toContain('background: currentColor')
  expect(grip).not.toContain('background: var(--command-grip)')
  expect(grip).not.toContain('opacity:')
})

test('header toolbars inherit shared control height without presentation or page overrides', () => {
  const variables = read('variable.css')
  expect([...variables.matchAll(/--control-block-size:/gu)]).toHaveLength(1)
  const toolbar = read('main.css').match(/\.controls-toolbar\s*\{([^}]+)/u)?.[1]
  expect(toolbar).not.toContain('--control-block-size:')
  const tools = read('components/page-header.css').match(/> \.tools\s*\{([^}]+)/u)?.[1]
  expect(tools).toContain('align-self: center')
  expect(tools).toContain('justify-items: end')
  for (const page of ['current-ship-loadout', 'ship-catalogue']) {
    expect(read(`pages/${page}.css`)).not.toContain('.page-header > .actions')
  }
})

test('saved-query action layout does not override the shared field wrapper', () => {
  const panel = read('pages/galaxy-query-editor.css').split('.save-query-panel {')[1]!
  expect(panel).toContain('> .actions {')
  expect(panel).not.toContain('> div {')
})

test('map corner controls use the header toolbar spacing and no schematic size override', () => {
  const header = read('components/page-header.css').match(/\.actions\s*\{([^}]+)/u)?.[1]
  expect(header).toContain('gap: var(--spacing-xs)')
  for (const [file, selector] of [['galactic-atlas', 'atlas-zoom'], ['system-schematic', 'system-schematic__zoom']]) {
    const source = read(`pages/${file}.css`)
    const controls = source.match(new RegExp(`\\.${selector}\\s*\\{([^}]+)`, 'u'))?.[1]
    expect(controls).toContain('gap: var(--spacing-xs)')
    expect(controls).not.toMatch(/(?:inline-size|block-size)\s*:/u)
  }
  expect(read('pages/system-schematic.css')).not.toContain('.system-schematic__zoom-step.btn')
})

test('shared fields replace the blue outline with themed inset keyboard focus and retain invalid borders', () => {
  const source = read('base/forms.css')
  const focus = source.match(/&:focus-visible\s*\{([^}]+)\}/u)?.[1]
  expect(focus).toContain('outline: none')
  expect(focus).toContain('box-shadow: inset 0 0 0 var(--control-border-width) var(--color-action)')
  expect(source).toContain('border: var(--control-border-width) solid var(--field-border)')
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
