import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { ensurePrivateDirectorySync, PRIVATE_FILE_MODE, restrictPrivateFileSync } from './private-user-state.js'

const Document = z.object({ apiKey: z.string().trim().min(20).max(500) }).strict()

/** One private credential file per non-OpenAI provider, never returned through settings. */
export class JsonApiKeyRepository {
  public constructor (private readonly path: string) {}
  public get (): string | undefined {
    if (!existsSync(this.path)) return undefined
    restrictPrivateFileSync(this.path)
    return Document.parse(JSON.parse(readFileSync(this.path, 'utf8'))).apiKey
  }
  public save (apiKey: string): void {
    const document = Document.parse({ apiKey })
    ensurePrivateDirectorySync(dirname(this.path))
    const temporary = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporary, `${JSON.stringify(document)}\n`, { mode: PRIVATE_FILE_MODE })
    renameSync(temporary, this.path)
    restrictPrivateFileSync(this.path)
  }
  public remove (): void { if (existsSync(this.path)) unlinkSync(this.path) }
}
