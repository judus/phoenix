import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  AiError,
  type AppendMessagesOptions,
  type Conversation,
  type ConversationMessage,
  type ConversationSnapshot,
  type ConversationStore,
  type CreateConversation,
  type MessageQuery
} from '@jdu/llm-client'

const SCHEMA_VERSION = 1

interface ConversationRecord {
  schemaVersion: typeof SCHEMA_VERSION
  conversation: Conversation
  messages: ConversationMessage[]
}

export interface JsonConversationStoreOptions {
  clock?: () => Date
  idGenerator?: () => string
}

/** Debug-friendly, atomic JSON persistence for the reusable AI client's conversation contract. */
export class JsonConversationStore implements ConversationStore {
  private readonly clock: () => Date
  private readonly idGenerator: () => string
  private readonly operationTails = new Map<string, Promise<void>>()

  public constructor (
    private readonly directory: string,
    options: JsonConversationStoreOptions = {}
  ) {
    this.clock = options.clock ?? (() => new Date())
    this.idGenerator = options.idGenerator ?? randomUUID
  }

  public create (input: CreateConversation = {}): Promise<Conversation> {
    const id = input.id ?? this.idGenerator()
    return this.exclusive(id, async () => {
      if (await this.read(id) !== undefined) throw conversationAlreadyExists(id)
      const occurredAt = this.clock().toISOString()
      const conversation: Conversation = {
        createdAt: occurredAt,
        id,
        ...(input.metadata === undefined ? {} : { metadata: clone(input.metadata) }),
        revision: 0,
        updatedAt: occurredAt
      }
      await this.write(id, {
        schemaVersion: SCHEMA_VERSION,
        conversation,
        messages: []
      })
      return clone(conversation)
    })
  }

  public async get (id: string): Promise<Conversation | undefined> {
    const record = await this.read(id)
    return record === undefined ? undefined : clone(record.conversation)
  }

  public append (
    id: string,
    messages: readonly ConversationMessage[],
    options: AppendMessagesOptions
  ): Promise<Conversation> {
    return this.exclusive(id, async () => {
      const record = await this.readRequired(id)
      if (record.conversation.revision !== options.expectedRevision) {
        throw new AiError('persistence_conflict', `Conversation ${id} changed concurrently.`, {
          code: 'conversation_revision_conflict',
          details: {
            actualRevision: record.conversation.revision,
            conversationId: id,
            expectedRevision: options.expectedRevision
          },
          retryable: true
        })
      }
      if (messages.length === 0) return clone(record.conversation)

      validateMessages(id, record.messages, messages)
      record.messages.push(...clone(messages))
      record.conversation = {
        ...record.conversation,
        revision: record.conversation.revision + 1,
        updatedAt: this.clock().toISOString()
      }
      await this.write(id, record)
      return clone(record.conversation)
    })
  }

  public async listMessages (
    id: string,
    query: MessageQuery = {}
  ): Promise<readonly ConversationMessage[]> {
    return selectMessages((await this.readRequired(id)).messages, query)
  }

  public async snapshot (
    id: string,
    query: MessageQuery = {}
  ): Promise<ConversationSnapshot | undefined> {
    const record = await this.read(id)
    if (record === undefined) return undefined
    return {
      conversation: clone(record.conversation),
      messages: selectMessages(record.messages, query)
    }
  }

  private async readRequired (id: string): Promise<ConversationRecord> {
    const record = await this.read(id)
    if (record === undefined) throw conversationNotFound(id)
    return record
  }

  private async read (id: string): Promise<ConversationRecord | undefined> {
    const file = this.fileForId(id)
    let serialized: string
    try {
      serialized = await readFile(file, 'utf8')
    } catch (cause) {
      if (isFileNotFound(cause)) return undefined
      throw persistenceFailure(`Unable to read conversation ${id}.`, 'conversation_read_failed', cause)
    }

    try {
      return parseRecord(JSON.parse(serialized) as unknown, id)
    } catch (cause) {
      if (cause instanceof AiError) throw cause
      throw persistenceFailure(
        `Conversation ${id} contains invalid JSON.`,
        'conversation_record_invalid',
        cause
      )
    }
  }

  private async write (id: string, record: ConversationRecord): Promise<void> {
    const file = this.fileForId(id)
    const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`
    try {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(temporaryFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
      await rename(temporaryFile, file)
    } catch (cause) {
      await unlink(temporaryFile).catch(() => {})
      throw persistenceFailure(`Unable to write conversation ${id}.`, 'conversation_write_failed', cause)
    }
  }

  private fileForId (id: string): string {
    return join(this.directory, `${conversationFileKey(id)}.json`)
  }

  private async exclusive<T> (id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(id) ?? Promise.resolve()
    let release: () => void = () => {}
    const gate = new Promise<void>(resolvePromise => { release = resolvePromise })
    const tail = previous.then(() => gate)
    this.operationTails.set(id, tail)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.operationTails.get(id) === tail) this.operationTails.delete(id)
    }
  }
}

export function conversationFileKey (conversationId: string): string {
  return createHash('sha256').update(`phoenix-copilot:v1:${conversationId}`).digest('hex')
}

function parseRecord (candidate: unknown, expectedId: string): ConversationRecord {
  if (!isRecord(candidate) || candidate.schemaVersion !== SCHEMA_VERSION) {
    throw invalidRecord(expectedId, 'schema version is missing or unsupported')
  }
  if (!isConversation(candidate.conversation) || candidate.conversation.id !== expectedId) {
    throw invalidRecord(expectedId, 'conversation metadata is invalid')
  }
  if (!Array.isArray(candidate.messages) || !candidate.messages.every(isConversationMessage)) {
    throw invalidRecord(expectedId, 'messages are invalid')
  }
  if (candidate.messages.some(message => message.conversationId !== expectedId)) {
    throw invalidRecord(expectedId, 'a message belongs to another conversation')
  }
  if (new Set(candidate.messages.map(message => message.id)).size !== candidate.messages.length) {
    throw invalidRecord(expectedId, 'message IDs are not unique')
  }
  return clone(candidate as unknown as ConversationRecord)
}

function isConversation (candidate: unknown): candidate is Conversation {
  return isRecord(candidate) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.id === 'string' &&
    Number.isSafeInteger(candidate.revision) &&
    (candidate.revision as number) >= 0 &&
    typeof candidate.updatedAt === 'string'
}

function isConversationMessage (candidate: unknown): candidate is ConversationMessage {
  return isRecord(candidate) &&
    Array.isArray(candidate.content) &&
    typeof candidate.conversationId === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.id === 'string' &&
    ['assistant', 'developer', 'system', 'tool', 'user'].includes(String(candidate.role))
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

function validateMessages (
  conversationId: string,
  existing: readonly ConversationMessage[],
  messages: readonly ConversationMessage[]
): void {
  const messageIds = new Set(existing.map(message => message.id))
  const batchIds = new Set<string>()
  for (const message of messages) {
    if (message.conversationId !== conversationId) {
      throw new AiError(
        'invalid_request',
        `Message ${message.id} belongs to another conversation.`,
        {
          code: 'message_conversation_mismatch',
          details: {
            conversationId,
            messageConversationId: message.conversationId,
            messageId: message.id
          }
        }
      )
    }
    if (messageIds.has(message.id) || batchIds.has(message.id)) {
      throw new AiError('persistence_conflict', `Message ${message.id} already exists.`, {
        code: 'duplicate_message_id',
        details: { conversationId, messageId: message.id }
      })
    }
    batchIds.add(message.id)
  }
}

function selectMessages (
  messages: readonly ConversationMessage[],
  query: MessageQuery
): readonly ConversationMessage[] {
  if (query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit <= 0)) {
    throw new AiError('invalid_request', 'Message query limit must be a positive safe integer.', {
      code: 'invalid_message_query_limit',
      details: { limit: query.limit }
    })
  }
  const afterIndex = query.afterId === undefined ? -1 : findMessage(messages, query.afterId)
  const beforeIndex = query.beforeId === undefined
    ? messages.length
    : findMessage(messages, query.beforeId)
  const selected = messages.slice(afterIndex + 1, beforeIndex)
  if (query.order === 'descending') selected.reverse()
  return clone(query.limit === undefined ? selected : selected.slice(0, query.limit))
}

function findMessage (messages: readonly ConversationMessage[], id: string): number {
  const index = messages.findIndex(message => message.id === id)
  if (index >= 0) return index
  throw new AiError('invalid_request', `Message ${id} was not found in the conversation.`, {
    code: 'message_cursor_not_found',
    details: { messageId: id }
  })
}

function conversationAlreadyExists (id: string): AiError {
  return new AiError('persistence_conflict', `Conversation ${id} already exists.`, {
    code: 'conversation_already_exists',
    details: { conversationId: id }
  })
}

function conversationNotFound (id: string): AiError {
  return new AiError('invalid_request', `Conversation ${id} was not found.`, {
    code: 'conversation_not_found',
    details: { conversationId: id }
  })
}

function invalidRecord (id: string, reason: string): AiError {
  return new AiError('persistence_conflict', `Conversation ${id} record is invalid: ${reason}.`, {
    code: 'conversation_record_invalid',
    details: { conversationId: id, reason }
  })
}

function persistenceFailure (message: string, code: string, cause: unknown): AiError {
  return new AiError('persistence_conflict', message, { cause, code })
}

function isFileNotFound (cause: unknown): boolean {
  return isRecord(cause) && cause.code === 'ENOENT'
}

function clone<T> (value: T): T {
  return structuredClone(value)
}
