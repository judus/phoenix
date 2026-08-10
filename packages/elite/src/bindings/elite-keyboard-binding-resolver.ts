import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import {
  GameActionBindingSourceDiagnosticsSchema,
  LogicalInputChordSchema,
  type GameActionBindingSourceDiagnostics,
  type LogicalInputChord
} from '@phoenix/contracts'

const parser = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  isArray: name => name === 'Modifier',
  parseAttributeValue: false,
  trimValues: true
})

export class EliteKeyboardBindingResolver {
  private bindings = new Map<string, LogicalInputChord>()
  private diagnostics: GameActionBindingSourceDiagnostics

  public constructor (private readonly directory: string | null) {
    this.diagnostics = emptyDiagnostics(directory)
    this.refresh()
  }

  public resolve (eliteBinding: string): LogicalInputChord | null {
    return this.bindings.get(eliteBinding) ?? null
  }

  public getDiagnostics (): GameActionBindingSourceDiagnostics {
    return GameActionBindingSourceDiagnosticsSchema.parse(structuredClone(this.diagnostics))
  }

  public refresh (): GameActionBindingSourceDiagnostics {
    let presetNames: string[] = []
    let filePath: string | null = null
    try {
      presetNames = this.readPresetNames()
      filePath = this.findActiveFile(presetNames)
    } catch (cause) {
      this.bindings = new Map()
      this.diagnostics = {
        ...emptyDiagnostics(this.directory),
        error: cause instanceof Error ? cause.message : 'Unable to discover Elite Dangerous bindings.'
      }
      return this.getDiagnostics()
    }
    if (!filePath) {
      this.bindings = new Map()
      this.diagnostics = {
        ...emptyDiagnostics(this.directory),
        presetNames,
        error: this.directory
          ? 'No active Elite Dangerous .binds file was found.'
          : 'Elite Dangerous bindings directory was not found.'
      }
      return this.getDiagnostics()
    }

    try {
      const root = asRecord(asRecord(parser.parse(readFileSync(filePath, 'utf8'))).Root)
      const discovered = Object.entries(root).filter(([, node]) => isBindingNode(node))
      this.bindings = new Map(
        discovered
          .map(([name, node]) => [name, resolveKeyboardBinding(node)] as const)
          .filter((entry): entry is readonly [string, LogicalInputChord] => entry[1] !== null)
      )
      this.diagnostics = GameActionBindingSourceDiagnosticsSchema.parse({
        directory: this.directory,
        filePath,
        presetNames,
        available: true,
        bindingCount: discovered.length,
        keyboardBindingCount: this.bindings.size,
        loadedAt: new Date().toISOString(),
        error: null
      })
    } catch (cause) {
      this.bindings = new Map()
      this.diagnostics = {
        ...emptyDiagnostics(this.directory),
        filePath,
        presetNames,
        error: cause instanceof Error ? cause.message : 'Unable to parse Elite Dangerous bindings.'
      }
    }
    return this.getDiagnostics()
  }

  private readPresetNames (): string[] {
    if (!this.directory || !existsSync(this.directory)) return []
    const names = readdirSync(this.directory)
      .filter(file => file.toLowerCase().endsWith('.start'))
      .sort()
      .flatMap(file => readFileSync(join(this.directory as string, file), 'utf8').split(/\r?\n/))
      .map(name => name.trim())
      .filter(Boolean)
      .reverse()
    return [...new Set(names)]
  }

  private findActiveFile (presetNames: string[]): string | null {
    if (!this.directory || !existsSync(this.directory)) return null
    const files = readdirSync(this.directory).filter(file => file.toLowerCase().endsWith('.binds'))
    for (const presetName of presetNames) {
      const match = latestVersion(files.filter(file => file.startsWith(`${presetName}.`)))
      if (match) return join(this.directory, match)
    }
    if (files.length === 1 && files[0]) return join(this.directory, files[0])
    const custom = latestVersion(files.filter(file => file.startsWith('Custom.')))
    return custom ? join(this.directory, custom) : null
  }
}

function resolveKeyboardBinding (candidate: unknown): LogicalInputChord | null {
  const node = asRecord(candidate)
  for (const element of [node.Primary, node.Secondary]) {
    const binding = asRecord(element)
    if (binding.Device !== 'Keyboard') continue
    const key = stripKeyPrefix(binding.Key)
    if (!key) continue
    const modifiers = asArray(binding.Modifier)
      .map(asRecord)
      .filter(modifier => modifier.Device === 'Keyboard')
      .map(modifier => stripKeyPrefix(modifier.Key))
      .filter((modifier): modifier is string => modifier !== null)
    return LogicalInputChordSchema.parse({
      key,
      modifiers,
      display: [...modifiers, key].join('+')
    })
  }
  return null
}

function isBindingNode (candidate: unknown): boolean {
  const node = asRecord(candidate)
  return 'Primary' in node || 'Secondary' in node
}

function stripKeyPrefix (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.startsWith('Key_')
    ? candidate.slice(4)
    : null
}

function latestVersion (files: string[]): string | null {
  return files.sort(compareVersions).at(-1) ?? null
}

function compareVersions (left: string, right: string): number {
  const leftVersion = left.match(/\d+/g)?.map(Number) ?? []
  const rightVersion = right.match(/\d+/g)?.map(Number) ?? []
  for (let index = 0; index < Math.max(leftVersion.length, rightVersion.length); index++) {
    const difference = (leftVersion[index] ?? 0) - (rightVersion[index] ?? 0)
    if (difference !== 0) return difference
  }
  return left.localeCompare(right)
}

function asRecord (candidate: unknown): Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : {}
}

function asArray (candidate: unknown): unknown[] {
  if (candidate === undefined || candidate === null) return []
  return Array.isArray(candidate) ? candidate : [candidate]
}

function emptyDiagnostics (directory: string | null): GameActionBindingSourceDiagnostics {
  return {
    directory,
    filePath: null,
    presetNames: [],
    available: false,
    bindingCount: 0,
    keyboardBindingCount: 0,
    loadedAt: null,
    error: null
  }
}
