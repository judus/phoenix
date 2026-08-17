import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { OpenAiSecretRepository } from '../domain/system-configuration.js'

const SecretDocumentSchema = z.object({
  openAiApiKey: z.string().trim().min(20).max(500)
})

export class JsonOpenAiSecretRepository implements OpenAiSecretRepository {
  public constructor (private readonly path: string) {}

  public get (): string | undefined {
    if (!existsSync(this.path)) return undefined
    return SecretDocumentSchema.parse(JSON.parse(readFileSync(this.path, 'utf8'))).openAiApiKey
  }

  public save (apiKey: string): void {
    const document = SecretDocumentSchema.parse({ openAiApiKey: apiKey })
    mkdirSync(dirname(this.path), { recursive: true })
    const temporaryPath = `${this.path}.tmp-${process.pid}`
    writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, this.path)
    chmodSync(this.path, 0o600)
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
