import type { JsonObject, JsonValue, ToolExecutionOutput } from '@jdu/llm-client'

/** Safe argument feedback; the tool boundary supplies its registered name. */
export class ToolArgumentError extends Error {
  public constructor (problem: string, public readonly correction: string) {
    super(problem)
    this.name = 'ToolArgumentError'
  }
}

export function output (text: string, structuredContent: JsonValue): ToolExecutionOutput {
  return {
    content: [{ source: 'generated', text, type: 'text' }],
    structuredContent
  }
}

export function emptyObjectSchema (): JsonObject {
  return { additionalProperties: false, properties: {}, type: 'object' }
}

export function stringArgument (arguments_: JsonObject, key: string): string {
  const value = arguments_[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ToolArgumentError(`${key} must be a non-empty string.`, `Provide ${key} as a string containing non-whitespace text.`)
  }
  return value.trim()
}

export function optionalStringArgument (arguments_: JsonObject, key: string): string | undefined {
  return arguments_[key] === undefined || arguments_[key] === null
    ? undefined
    : stringArgument(arguments_, key)
}

export function optionalIntegerArgument (arguments_: JsonObject, key: string): number | undefined {
  const value = arguments_[key]
  if (value === undefined || value === null) return undefined
  if (!Number.isSafeInteger(value)) throw new ToolArgumentError(`${key} must be an integer.`, `Provide ${key} as an integer, or omit this optional argument.`)
  return value as number
}

export function optionalBooleanArgument (arguments_: JsonObject, key: string): boolean | undefined {
  const value = arguments_[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw new ToolArgumentError(`${key} must be a boolean.`, `Provide ${key} as true or false, or omit this optional argument.`)
  return value
}

export function booleanArgument (arguments_: JsonObject, key: string): boolean {
  const value = arguments_[key]
  if (typeof value !== 'boolean') throw new ToolArgumentError(`${key} must be a boolean.`, `Provide ${key} as true or false.`)
  return value
}

export function stringArrayArgument (arguments_: JsonObject, key: string): string[] {
  const value = arguments_[key]
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    throw new ToolArgumentError(`${key} must be an array of non-empty strings.`, `Provide ${key} as an array of strings containing non-whitespace text.`)
  }
  return value.map(item => (item as string).trim())
}

export function boundedLimit (value: number | undefined, fallback: number, maximum: number): number {
  return value === undefined ? fallback : Math.min(Math.max(value, 1), maximum)
}

export function json (value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

export function displayName (label: string | null | undefined, id: string): string {
  return label ?? id
}
