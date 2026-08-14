/** Classifier for sanitized provider-neutral Harness logical requests. */
import type {
  ContextTaxonomy, TaxonomyCategory, TaxonomyItem, TaxonomyPart,
} from '../types.ts'
import type { SanitizedJson, SanitizedLogicalRequest } from './sanitize.ts'
import { estimateTokens, previewText } from './segments.ts'
import { validateLogicalReasoning } from './reasoning.ts'

const CATEGORIES: readonly TaxonomyCategory[] = [
  'system', 'conversation', 'current-prompt', 'tools', 'options', 'unclassified',
]

function asRecord(value: SanitizedJson | undefined): Record<string, SanitizedJson> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function stringify(value: SanitizedJson): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function part(
  order: number,
  kind: TaxonomyPart['kind'],
  label: string,
  path: string,
  value: SanitizedJson,
): TaxonomyPart {
  const text = stringify(value)
  return Object.freeze({
    order,
    kind,
    label,
    path,
    format: kind === 'text' || kind === 'reasoning' ? 'markdown' : 'json',
    estimatedTokens: estimateTokens(text),
    text,
  })
}

function messageParts(message: Record<string, SanitizedJson>, base: string): readonly TaxonomyPart[] {
  const parts: TaxonomyPart[] = []
  const content = Array.isArray(message.content) ? message.content : []
  content.forEach((value, index) => {
    const item = asRecord(value)
    const type = typeof item?.type === 'string' ? item.type : 'unclassified'
    const path = `${base}.content[${index}]`
    switch (type) {
      case 'text':
        parts.push(part(parts.length + 1, 'text', 'Text', `${path}.text`, item?.text ?? value))
        break
      case 'reasoning':
        parts.push(part(parts.length + 1, 'reasoning', 'Reasoning', `${path}.text`, item?.text ?? value))
        break
      case 'tool-call':
        parts.push(part(parts.length + 1, 'tool-call', `Tool call: ${String(item?.name ?? 'unknown')}`, path, value))
        break
      case 'tool-result':
        parts.push(part(parts.length + 1, 'tool-result', 'Tool result', path, value))
        break
      case 'image':
        parts.push(part(parts.length + 1, 'attachment', 'Image attachment reference', path, value))
        break
      default:
        parts.push(part(parts.length + 1, 'unclassified', `Unclassified content: ${type}`, path, value))
        break
    }
  })

  for (const key of Object.keys(message).sort()) {
    if (key === 'content') continue
    const known = key === 'id' || key === 'role' || key === 'source'
    parts.push(part(
      parts.length + 1,
      known ? 'metadata' : 'unclassified',
      known ? key : `Unclassified message field: ${key}`,
      `${base}.${key}`,
      message[key] ?? null,
    ))
  }
  return Object.freeze(parts)
}

function itemFrom(
  order: number,
  category: TaxonomyCategory,
  role: string,
  label: string,
  path: string,
  parts: readonly TaxonomyPart[],
  source?: Record<string, SanitizedJson>,
): TaxonomyItem {
  const text = parts.map(candidate => candidate.text).join('\n')
  const form = source?.form
  return Object.freeze({
    order,
    category,
    role,
    ...(typeof source?.kind === 'string' ? { sourceKind: source.kind } : {}),
    ...(form === 'instructions' || form === 'catalog' || form === 'snapshot'
      || form === 'notice' || form === 'relay' || form === 'recall' ? { contextForm: form } : {}),
    label,
    path,
    estimatedTokens: parts.reduce((sum, candidate) => sum + candidate.estimatedTokens, 0),
    preview: previewText(text),
    parts,
  })
}

/**
 * Derive the UI taxonomy from one sanitized canonical request.
 * @param request - sanitized-only canonical value and metadata.
 * @returns deterministic DSH taxonomy v1.
 */
export function classifyLogicalRequest(request: SanitizedLogicalRequest): ContextTaxonomy {
  const value = request.value
  const provider = typeof value.provider === 'string' ? value.provider : 'unknown'
  const model = typeof value.model === 'string' ? value.model : 'unknown'
  const items: TaxonomyItem[] = []
  let order = 1

  if (typeof value.system === 'string') {
    const parts = Object.freeze([part(1, 'text', 'System prompt', '$.system', value.system)])
    items.push(itemFrom(order++, 'system', 'system', 'System prompt', '$.system', parts))
  }

  const messages = Array.isArray(value.messages) ? value.messages : []
  let currentUserIndex = -1
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = asRecord(messages[index])
    const source = asRecord(message?.source)
    if (message?.role === 'user' && source?.kind === 'user') {
      currentUserIndex = index
      break
    }
  }
  if (currentUserIndex === -1) {
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = asRecord(messages[index])
      const source = asRecord(message?.source)
      if (message?.role === 'user' && source?.kind !== 'tool') {
        currentUserIndex = index
        break
      }
    }
  }
  const currentPromptIndexes = new Set<number>()
  if (currentUserIndex !== -1) {
    currentPromptIndexes.add(currentUserIndex)
    for (let index = currentUserIndex + 1; index < messages.length; index++) {
      const message = asRecord(messages[index])
      const source = asRecord(message?.source)
      if (message?.role !== 'user' || source?.kind !== 'plugin') break
      currentPromptIndexes.add(index)
    }
  }
  messages.forEach((entry, index) => {
    const message = asRecord(entry)
    if (message === undefined) {
      const parts = Object.freeze([part(1, 'unclassified', 'Unclassified message', `$.messages[${index}]`, entry)])
      items.push(itemFrom(order++, 'unclassified', 'unknown', `Unclassified message ${index + 1}`, `$.messages[${index}]`, parts))
      return
    }
    const role = typeof message.role === 'string' ? message.role : 'unknown'
    const source = asRecord(message.source)
    const isCurrentPrompt = currentPromptIndexes.has(index)
    const category: TaxonomyCategory = isCurrentPrompt ? 'current-prompt' : 'conversation'
    const label = isCurrentPrompt
      ? source?.kind === 'user' ? 'Current user prompt' : `Current context${typeof source?.form === 'string' ? `: ${source.form}` : ''}`
      : `${role[0]?.toUpperCase() ?? ''}${role.slice(1)} message ${index + 1}`
    items.push(itemFrom(order++, category, role, label, `$.messages[${index}]`, messageParts(message, `$.messages[${index}]`), source))
  })

  if (Array.isArray(value.tools)) {
    value.tools.forEach((tool, index) => {
      const toolRecord = asRecord(tool)
      const name = typeof toolRecord?.name === 'string' ? toolRecord.name : `${index + 1}`
      const parts = Object.freeze([part(1, 'metadata', 'Tool definition', `$.tools[${index}]`, tool)])
      items.push(itemFrom(order++, 'tools', 'tool-definition', `Tool: ${name}`, `$.tools[${index}]`, parts))
    })
  }

  const optionKeys = ['provider', 'model', 'reasoningEffort', 'temperature', 'maxTokens', 'stop'] as const
  const optionParts = optionKeys.flatMap((key) => value[key] === undefined
    ? []
    : [part(0, 'metadata', key, `$.${key}`, value[key])])
    .map((candidate, index) => Object.freeze({ ...candidate, order: index + 1 }))
  if (optionParts.length > 0) {
    items.push(itemFrom(order++, 'options', 'request-options', 'Harness request options', '$', Object.freeze(optionParts)))
  }

  if (value.unclassified !== undefined) {
    const record = asRecord(value.unclassified)
    const parts = Object.freeze(Object.keys(record ?? {}).map((key, index) =>
      part(index + 1, 'unclassified', `Unclassified request field: ${key}`, `$.unclassified.${key}`, record?.[key] ?? null)))
    items.push(itemFrom(order++, 'unclassified', 'unclassified', 'Unclassified logical request fields', '$.unclassified', parts))
  }

  const estimatedByCategory = Object.fromEntries(CATEGORIES.map(category => [category, 0])) as Record<TaxonomyCategory, number>
  for (const item of items) estimatedByCategory[item.category] += item.estimatedTokens
  const reasoning = validateLogicalReasoning(provider, model, messages)
  return Object.freeze({
    taxonomyVersion: 1,
    source: 'dsh-logical-call',
    provider,
    model,
    topLevelOrder: Object.freeze(Object.keys(value)),
    items: Object.freeze(items),
    estimatedByCategory: Object.freeze(estimatedByCategory),
    redactionCount: request.redactionCount,
    reasoning,
  })
}
