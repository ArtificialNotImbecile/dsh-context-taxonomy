/** Honest DeepSeek checks over Harness logical messages only. */
import type { LogicalReasoningCheck } from '../types.ts'
import type { SanitizedJson } from './sanitize.ts'

function record(value: SanitizedJson | undefined): Record<string, SanitizedJson> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}
function blocks(message: Record<string, SanitizedJson>): readonly SanitizedJson[] {
  return Array.isArray(message.content) ? message.content : []
}

/**
 * Check that logical assistant tool-call messages retain non-empty reasoning.
 * @param provider - Harness provider route.
 * @param model - Harness model id.
 * @param messages - sanitized provider-neutral messages.
 * @returns logical-only policy result; it never asserts provider-wire fidelity.
 */
export function validateLogicalReasoning(
  provider: string,
  model: string,
  messages: readonly SanitizedJson[],
): LogicalReasoningCheck {
  if (!`${provider} ${model}`.toLowerCase().includes('deepseek')) {
    return Object.freeze({
      status: 'unknown',
      policyId: 'unknown',
      summary: 'No logical reasoning-retention check is registered for this provider and model.',
      requiredMessageIndexes: Object.freeze([]),
      missingMessageIndexes: Object.freeze([]),
    })
  }

  const required: number[] = []
  const missing: number[] = []
  messages.forEach((value, index) => {
    const message = record(value)
    if (message?.role !== 'assistant') return
    const content = blocks(message)
    const hasToolCall = content.some((part) => record(part)?.type === 'tool-call')
    if (!hasToolCall) return
    required.push(index)
    const hasReasoning = content.some((part) => {
      const candidate = record(part)
      return candidate?.type === 'reasoning' && typeof candidate.text === 'string' && candidate.text.trim().length > 0
    })
    if (!hasReasoning) missing.push(index)
  })

  if (required.length === 0) {
    return Object.freeze({
      status: 'not-applicable',
      policyId: 'deepseek-logical-tool-interval-v1',
      summary: 'No historical assistant tool-call message requires a logical reasoning block in this call.',
      requiredMessageIndexes: Object.freeze(required),
      missingMessageIndexes: Object.freeze(missing),
    })
  }
  return Object.freeze({
    status: missing.length === 0 ? 'pass' : 'fail',
    policyId: 'deepseek-logical-tool-interval-v1',
    summary: missing.length === 0
      ? `All ${required.length} logical assistant tool-call messages retain a reasoning block.`
      : `${missing.length} of ${required.length} logical assistant tool-call messages have no reasoning block. This does not prove the provider wire payload.`,
    requiredMessageIndexes: Object.freeze(required),
    missingMessageIndexes: Object.freeze(missing),
  })
}
