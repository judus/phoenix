import {
  ControlDeckMacroDefinitionSchema,
  ControlDeckMacroLibrarySchema,
  type ControlDeckMacroDefinition,
  type ControlDeckMacroRepository
} from '@jdu/control-deck-core'
import { readPrivateJsonFile, writePrivateJsonFile } from './private-json-file.js'

export class FileControlDeckMacroRepository implements ControlDeckMacroRepository {
  public constructor (private readonly path: string) {}

  public delete (id: string): void {
    const library = this.getLibrary()
    const macros = library.macros.filter(macro => macro.id !== id)
    if (macros.length === library.macros.length) throw new Error(`Unknown macro: ${id}.`)
    writePrivateJsonFile(this.path, { version: 1, macros })
  }

  public get (id: string): ControlDeckMacroDefinition | null {
    return this.getLibrary().macros.find(macro => macro.id === id) ?? null
  }

  public getLibrary () {
    const candidate = readPrivateJsonFile(this.path)
    if (candidate !== null) return ControlDeckMacroLibrarySchema.parse(candidate)
    const empty = ControlDeckMacroLibrarySchema.parse({ version: 1, macros: [] })
    writePrivateJsonFile(this.path, empty)
    return empty
  }

  public save (candidate: ControlDeckMacroDefinition): ControlDeckMacroDefinition {
    const macro = ControlDeckMacroDefinitionSchema.parse(candidate)
    const library = this.getLibrary()
    const macros = library.macros.some(existing => existing.id === macro.id)
      ? library.macros.map(existing => existing.id === macro.id ? macro : existing)
      : [...library.macros, macro]
    writePrivateJsonFile(this.path, ControlDeckMacroLibrarySchema.parse({ version: 1, macros }))
    return this.get(macro.id)!
  }
}
