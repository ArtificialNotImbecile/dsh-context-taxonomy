/** Mandatory sanitization and canonical serialization for logical requests. */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm/types'

/** JSON value accepted by the sanitized sidecar. */
export type SanitizedJson = null | boolean | number | string | SanitizedJson[] | { [key: string]: SanitizedJson }

/** Canonical sanitized request plus integrity metadata. */
export interface SanitizedLogicalRequest {
  /** Detached sanitized value in fixed semantic order. */
  readonly value: Readonly<Record<string, SanitizedJson>>
  /** Pretty canonical JSON persisted to disk. */
  readonly json: string
  /** SHA-256 over `json`, never over unsanitized input. */
  readonly logicalRequestHash: string
  /** UTF-8 byte length of `json`. */
  readonly byteCount: number
  /** Mandatory redaction replacement count. */
  readonly redactionCount: number
}

const BUILTIN_SECRET_KEY = /(?:^|[_-])(?:api[_-]?key|access[_-]?key|secret|token|authorization|password|passwd|credential|cookie|private[_-]?key)(?:$|[_-])/iu
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu
const CREDENTIAL_QUERY = /([?&](?:api[_-]?key|access[_-]?token|token|key|secret|signature)=)[^&#\s]+/giu
const DATA_URL = /^data:[^,]{0,200},/iu
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u

/**
 * Sanitize and serialize one public Harness logical request.
 * @param options - deep-frozen provider-neutral request observed at `llm/stream`.
 * @param extraKeyPatterns - deployment-supplied key regular expressions added to mandatory rules.
 * @returns detached canonical JSON and sanitized-only integrity metadata.
 */
export function sanitizeLogicalRequest(
  options: GenerateOptions,
  extraKeyPatterns: readonly RegExp[] = [],
): SanitizedLogicalRequest {
  let redactionCount = 0
  const seen = new WeakSet<object>()
  const redact = (): string => {
    redactionCount++
    return '[redacted]'
  }

  const visit = (input: unknown, key: string): SanitizedJson => {
    if (BUILTIN_SECRET_KEY.test(key) || extraKeyPatterns.some(pattern => pattern.test(key))) return redact()
    if (input === null) return null
    if (typeof input === 'string') {
      if (DATA_URL.test(input)) {
        redactionCount++
        return `[redacted data URL; ${input.length} chars]`
      }
      if (input.length >= 256 && input.length % 4 === 0 && BASE64.test(input)) {
        redactionCount++
        return `[redacted base64; ${input.length} chars]`
      }
      let value = input.replace(BEARER, () => {
        redactionCount++
        return 'Bearer [redacted]'
      })
      value = value.replace(CREDENTIAL_QUERY, (_match, prefix: string) => {
        redactionCount++
        return `${prefix}[redacted]`
      })
      return value
    }
    if (typeof input === 'number') return Number.isFinite(input) ? input : String(input)
    if (typeof input === 'boolean') return input
    if (typeof input === 'bigint') return input.toString()
    if (typeof input === 'undefined') return '[undefined]'
    if (typeof input === 'function' || typeof input === 'symbol') return `[${typeof input}]`
    if (seen.has(input)) {
      redactionCount++
      return '[circular]'
    }
    seen.add(input)
    try {
      if (Array.isArray(input)) return input.map(entry => visit(entry, key))
      const source = input as Record<string, unknown>
      const result: Record<string, SanitizedJson> = {}
      for (const childKey of Object.keys(source).sort()) result[childKey] = visit(source[childKey], childKey)
      return result
    } finally {
      seen.delete(input)
    }
  }

  const known = new Set([
    'provider', 'model', 'reasoningEffort', 'temperature', 'maxTokens', 'stop',
    'system', 'messages', 'tools', 'signal', 'sessionId', 'purpose',
  ])
  const value: Record<string, SanitizedJson> = {
    provider: visit(options.provider, 'provider'),
    model: visit(options.model, 'model'),
  }
  if (options.reasoningEffort !== undefined) value.reasoningEffort = visit(options.reasoningEffort, 'reasoningEffort')
  if (options.temperature !== undefined) value.temperature = visit(options.temperature, 'temperature')
  if (options.maxTokens !== undefined) value.maxTokens = visit(options.maxTokens, 'maxTokens')
  if (options.stop !== undefined) value.stop = visit(options.stop, 'stop')
  if (options.system !== undefined) value.system = visit(options.system, 'system')
  value.messages = visit(options.messages, 'messages')
  if (options.tools !== undefined) value.tools = visit(options.tools, 'tools')

  const unknown: Record<string, SanitizedJson> = {}
  for (const key of Object.keys(options as unknown as Record<string, unknown>).sort()) {
    if (!known.has(key)) unknown[key] = visit((options as unknown as Record<string, unknown>)[key], key)
  }
  if (Object.keys(unknown).length > 0) value.unclassified = unknown

  const json = JSON.stringify(value, null, 2)
  return Object.freeze({
    value: Object.freeze(value),
    json,
    logicalRequestHash: createHash('sha256').update(json).digest('hex'),
    byteCount: Buffer.byteLength(json, 'utf8'),
    redactionCount,
  })
}

/**
 * Compile additive redaction-key patterns at the configuration boundary.
 * @param sources - regular-expression source strings.
 * @returns case-insensitive Unicode expressions.
 */
export function compileRedactKeyPatterns(sources: readonly string[]): readonly RegExp[] {
  return Object.freeze(sources.map((source) => {
    try {
      return new RegExp(source, 'iu')
    } catch (error: unknown) {
      throw new TypeError(`context-taxonomy: invalid extraRedactKeyPatterns entry ${JSON.stringify(source)}`, { cause: error })
    }
  }))
}
