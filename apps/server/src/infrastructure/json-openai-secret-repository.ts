import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { OpenAiSecretRepository } from '../domain/system-configuration.js'
import { ensurePrivateDirectorySync, PRIVATE_FILE_MODE, restrictPrivateFileSync } from './private-user-state.js'

const SecretDocumentSchema = z.object({
  openAiApiKey: z.string().trim().min(20).max(500)
})

export class JsonOpenAiSecretRepository implements OpenAiSecretRepository {
  public constructor (private readonly path: string) {}

  public get (): string | undefined {
    if (!existsSync(this.path)) return undefined
    restrictPrivateFileSync(this.path)
    return SecretDocumentSchema.parse(JSON.parse(readFileSync(this.path, 'utf8'))).openAiApiKey
  }

  public save (apiKey: string): void {
    const document = SecretDocumentSchema.parse({ openAiApiKey: apiKey })
    ensurePrivateDirectorySync(dirname(this.path))
    const temporaryPath = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: PRIVATE_FILE_MODE })
    restrictPrivateFileSync(temporaryPath)
    renameSync(temporaryPath, this.path)
    restrictPrivateFileSync(this.path)
  }

  public remove (): void {
    if (existsSync(this.path)) unlinkSync(this.path)
  }
}

export class InMemoryOpenAiSecretRepository implements OpenAiSecretRepository {
  public constructor (private apiKey?: string) {}
  public get (): string | undefined { return this.apiKey }
  public save (apiKey: string): void { this.apiKey = apiKey }
  public remove (): void { this.apiKey = undefined }
}
