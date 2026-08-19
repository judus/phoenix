import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  MacroDefinitionSchema,
  MacroLibrarySchema,
  type MacroDefinition,
  type MacroLibrary
} from '@phoenix/contracts'
import type { MacroRepository } from '../domain/macros.js'
import { ensurePrivateDirectorySync, PRIVATE_FILE_MODE, restrictPrivateFileSync } from './private-user-state.js'

const EMPTY_LIBRARY: MacroLibrary = { version: 1, macros: [] }

export class InMemoryMacroRepository implements MacroRepository {
  private library: MacroLibrary = EMPTY_LIBRARY

  public delete (id: string): void {
    this.library = { ...this.library, macros: this.library.macros.filter(macro => macro.id !== id) }
  }

  public get (id: string): MacroDefinition | undefined { return this.library.macros.find(macro => macro.id === id) }
  public getLibrary (): MacroLibrary { return MacroLibrarySchema.parse(this.library) }

  public save (candidate: MacroDefinition): MacroDefinition {
    const definition = MacroDefinitionSchema.parse(candidate)
    this.library = {
      version: 1,
      macros: [...this.library.macros.filter(macro => macro.id !== definition.id), definition]
        .sort((left, right) => left.name.localeCompare(right.name))
    }
    return definition
  }
}

export class JsonMacroRepository implements MacroRepository {
  public constructor (private readonly path: string) {}

  public delete (id: string): void {
    const library = this.getLibrary()
    this.write({ ...library, macros: library.macros.filter(macro => macro.id !== id) })
  }

  public get (id: string): MacroDefinition | undefined { return this.getLibrary().macros.find(macro => macro.id === id) }

  public getLibrary (): MacroLibrary {
    if (!existsSync(this.path)) return EMPTY_LIBRARY
    restrictPrivateFileSync(this.path)
    return MacroLibrarySchema.parse(JSON.parse(readFileSync(this.path, 'utf8')))
  }

  public save (candidate: MacroDefinition): MacroDefinition {
    const definition = MacroDefinitionSchema.parse(candidate)
    const library = this.getLibrary()
    this.write({
      version: 1,
      macros: [...library.macros.filter(macro => macro.id !== definition.id), definition]
        .sort((left, right) => left.name.localeCompare(right.name))
    })
    return definition
  }

  private write (candidate: MacroLibrary): void {
    const library = MacroLibrarySchema.parse(candidate)
    ensurePrivateDirectorySync(dirname(this.path))
    const temporary = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporary, `${JSON.stringify(library, null, 2)}\n`, { encoding: 'utf8', mode: PRIVATE_FILE_MODE })
    restrictPrivateFileSync(temporary)
    renameSync(temporary, this.path)
    restrictPrivateFileSync(this.path)
  }
}
