import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { describe, expect, test } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '..')
const webRoot = resolve(repositoryRoot, 'apps/web/src')
const featuresRoot = resolve(webRoot, 'features')

describe('frontend ownership boundaries', () => {
  test('features do not import sibling feature internals', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(featuresRoot)) {
      const owner = relative(featuresRoot, file).split(sep)[0]
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
        const specifier = match[1]
        if (!specifier?.startsWith('.')) continue
        const destination = resolve(dirname(file), specifier)
        const destinationRelative = relative(featuresRoot, destination)
        if (destinationRelative.startsWith('..')) continue
        const dependency = destinationRelative.split(sep)[0]
        if (dependency !== owner) offenders.push(`${relative(repositoryRoot, file)} -> ${specifier}`)
      }
    }

    expect(offenders).toEqual([])
  })

  test('features do not own raw browser routing, storage, or PHOENIX event streams', () => {
    const forbidden = /(?:window\.(?:location|localStorage|sessionStorage)|globalThis\.(?:localStorage|sessionStorage)|new\s+EventSource\b)/u
    const offenders = sourceFiles(featuresRoot)
      .filter(file => forbidden.test(readFileSync(file, 'utf8')))
      .map(file => relative(repositoryRoot, file))

    expect(offenders).toEqual([])
  })
})

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (entry.isFile() && /\.[jt]sx?$/u.test(entry.name)) files.push(path)
  }
  return files
}
