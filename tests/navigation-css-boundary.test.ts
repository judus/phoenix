import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '..')
const navigationStylesheet = resolve(repositoryRoot, 'packages/ui/src/styles/components/navigation.css')
const navigationSelector = /(?:\.nav-item\b|nav\.application-navigation\b|nav\.app-navigation\b|\.selection-subtle\b)/

describe('navigation stylesheet boundary', () => {
  test('only navigation.css declares navigation item styles and states', () => {
    const offenders = cssFiles(repositoryRoot)
      .filter(file => file !== navigationStylesheet)
      .filter(file => navigationSelector.test(readFileSync(file, 'utf8')))
      .map(file => relative(repositoryRoot, file))

    expect(offenders).toEqual([])
  })

  test('navigation items expose only default, active, and keyboard-focus visual states', () => {
    const stylesheet = readFileSync(navigationStylesheet, 'utf8')

    expect(stylesheet).not.toMatch(/:(?:hover|active)\b/)
    expect(stylesheet).toMatch(/&:focus-visible\s*{[^}]*outline:\s*2px solid var\(--color-action\)/s)
    expect(stylesheet).not.toMatch(/\.disabled\b/)
  })
})

function cssFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'storybook-static' || entry.name === '.git') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...cssFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.css')) files.push(path)
  }

  return files
}
