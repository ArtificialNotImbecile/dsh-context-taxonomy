import { describe, expect, it } from 'vitest'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm/types'
import { classifyLogicalRequest } from '../src/taxonomy/classify.ts'
import { validateLogicalReasoning } from '../src/taxonomy/reasoning.ts'
import { estimateTokens } from '../src/taxonomy/segments.ts'
import { sanitizeLogicalRequest } from '../src/taxonomy/sanitize.ts'

function request(overrides: Record<string, unknown> = {}): GenerateOptions {
  return {
    provider: 'deepseek',
    model: 'deepseek-chat',
    system: 'Follow the workspace instructions.',
    messages: [{
      id: 'message-1',
      role: 'user',
      source: { kind: 'plugin', plugin: 'fixture', form: 'instructions' },
      content: [{ type: 'text', text: '你好 world' }],
    }],
    tools: [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object' } }],
    ...overrides,
  } as unknown as GenerateOptions
}

describe('logical request sanitization', () => {
  it('uses stable semantic order and hashes sanitized content only', () => {
    const first = sanitizeLogicalRequest(request({
      extensionZ: { token: 'secret-token' },
      extensionA: 'https://example.test/?api_key=do-not-store',
    }))
    const second = sanitizeLogicalRequest(request({
      extensionA: 'https://example.test/?api_key=changed-secret',
      extensionZ: { token: 'another-secret' },
    }))

    expect(Object.keys(first.value)).toEqual([
      'provider', 'model', 'system', 'messages', 'tools', 'unclassified',
    ])
    expect(first.json).not.toContain('do-not-store')
    expect(first.json).not.toContain('secret-token')
    expect(first.logicalRequestHash).toBe(second.logicalRequestHash)
    expect(first.redactionCount).toBe(2)
  })

  it('redacts bearer, data URL, base64, circular values, and additive keys', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const sanitized = sanitizeLogicalRequest(request({
      authHeader: 'Bearer abc.def-123',
      image: `data:image/png;base64,${'A'.repeat(400)}`,
      encoded: 'A'.repeat(256),
      cycle,
      tenantPin: '1234',
    }), [/tenantPin/u])

    expect(sanitized.json).toContain('Bearer [redacted]')
    expect(sanitized.json).toContain('[redacted data URL;')
    expect(sanitized.json).toContain('[redacted base64;')
    expect(sanitized.json).toContain('[circular]')
    expect(sanitized.json).not.toContain('1234')
  })

  it('preserves repeated non-circular object values', () => {
    const shared = { safe: 'same' }
    const sanitized = sanitizeLogicalRequest(request({ first: shared, second: shared }))
    expect(sanitized.json.match(/"safe": "same"/gu)).toHaveLength(2)
  })
})

describe('taxonomy classification', () => {
  it('classifies current prompt, ContextForm, tools, options, and unknown fields', () => {
    const sanitized = sanitizeLogicalRequest(request({ customExtension: { value: true } }))
    const taxonomy = classifyLogicalRequest(sanitized)

    expect(taxonomy.source).toBe('dsh-logical-call')
    expect(taxonomy.items.find(item => item.category === 'current-prompt')).toMatchObject({
      sourceKind: 'plugin',
      contextForm: 'instructions',
    })
    expect(taxonomy.items.some(item => item.category === 'tools')).toBe(true)
    expect(taxonomy.items.some(item => item.category === 'options')).toBe(true)
    expect(taxonomy.items.some(item => item.category === 'unclassified')).toBe(true)
    expect(Object.values(taxonomy.estimatedByCategory).reduce((sum, value) => sum + value, 0))
      .toBe(taxonomy.items.reduce((sum, item) => sum + item.estimatedTokens, 0))
  })

  it('groups the current user prompt with immediately following plugin context', () => {
    const sanitized = sanitizeLogicalRequest(request({
      messages: [
        {
          id: 'user-1', role: 'user', source: { kind: 'user' },
          content: [{ type: 'text', text: 'Inspect the current Harness call.' }],
        },
        {
          id: 'snapshot-1', role: 'user',
          source: { kind: 'plugin', plugin: 'runtime', form: 'snapshot' },
          content: [{ type: 'text', text: 'Workspace snapshot' }],
        },
        {
          id: 'assistant-1', role: 'assistant', source: { kind: 'model' },
          content: [{ type: 'tool-call', id: 'call-1', name: 'read', arguments: {} }],
        },
        {
          id: 'tool-1', role: 'user', source: { kind: 'tool' },
          content: [{ type: 'tool-result', toolCallId: 'call-1', result: 'done' }],
        },
      ],
    }))

    const current = classifyLogicalRequest(sanitized).items.filter(item => item.category === 'current-prompt')
    expect(current).toMatchObject([
      { label: 'Current user prompt', sourceKind: 'user' },
      { label: 'Current context: snapshot', sourceKind: 'plugin', contextForm: 'snapshot' },
    ])
  })

  it('estimates CJK characters independently from Latin text', () => {
    expect(estimateTokens('你好世界')).toBe(4)
    expect(estimateTokens('abcdefgh')).toBe(2)
    expect(estimateTokens('你好abcd')).toBe(3)
  })
})

describe('DeepSeek logical reasoning check', () => {
  const toolCall = { type: 'tool-call', id: 'call-1', name: 'read', arguments: {} }

  it('passes only when required logical tool-call history retains reasoning', () => {
    const check = validateLogicalReasoning('deepseek', 'deepseek-reasoner', [{
      role: 'assistant',
      content: [{ type: 'reasoning', text: 'Need the file.' }, toolCall],
    }])
    expect(check.status).toBe('pass')
  })

  it('reports a logical-only failure without claiming provider-wire evidence', () => {
    const check = validateLogicalReasoning('deepseek', 'deepseek-reasoner', [{
      role: 'assistant', content: [toolCall],
    }])
    expect(check.status).toBe('fail')
    expect(check.summary).toContain('does not prove the provider wire payload')
    expect(check.missingMessageIndexes).toEqual([0])
  })
})
