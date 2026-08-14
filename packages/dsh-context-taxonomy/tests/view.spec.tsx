import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { CaptureId, CaptureRecord, ContextTaxonomy } from '../src/types.ts'
import type { ContextTaxonomyViewState } from '../src/client/controller.ts'
import { ContextTaxonomyView } from '../src/client/ContextTaxonomyView.tsx'
import type { ContextTaxonomyViewProps } from '../src/client/slots.ts'

const captureId = '123e4567-e89b-42d3-a456-426614174004' as CaptureId
const capture: CaptureRecord = {
  formatVersion: 1,
  taxonomyVersion: 1,
  captureId,
  session: { id: 'session-fixture' as SessionId, createdAt: 1 },
  location: { turn: 2, step: 3, callOrdinal: 1, stepStartSeq: 4 },
  provider: 'deepseek',
  model: 'deepseek-chat',
  source: 'dsh-logical-call',
  startedAt: 1,
  settledAt: 5,
  status: 'settled',
  observedOutcome: { kind: 'stop' },
  usage: { inputTokens: 10, outputTokens: 4 },
  raw: { state: 'available', logicalRequestHash: 'a'.repeat(64), charCount: 20 },
  summary: {
    estimatedTokens: 7,
    itemCount: 1,
    estimatedByCategory: {
      system: 0, conversation: 0, 'current-prompt': 7, tools: 0, options: 0, unclassified: 0,
    },
    topLevelOrder: ['provider', 'model', 'messages'],
    redactionCount: 0,
    reasoningStatus: 'not-applicable',
  },
}
const taxonomy: ContextTaxonomy = {
  taxonomyVersion: 1,
  source: 'dsh-logical-call',
  provider: 'deepseek',
  model: 'deepseek-chat',
  topLevelOrder: ['provider', 'model', 'messages'],
  items: [{
    order: 1,
    category: 'current-prompt',
    role: 'user',
    sourceKind: 'user',
    label: 'Current prompt',
    path: '$.messages[0]',
    estimatedTokens: 7,
    preview: 'hello',
    parts: [{
      order: 1,
      kind: 'text',
      label: 'Text',
      path: '$.messages[0].content[0].text',
      format: 'markdown',
      estimatedTokens: 7,
      text: 'hello',
    }],
  }],
  estimatedByCategory: {
    system: 0, conversation: 0, 'current-prompt': 7, tools: 0, options: 0, unclassified: 0,
  },
  redactionCount: 0,
  reasoning: {
    status: 'not-applicable', policyId: 'deepseek-logical-tool-interval-v1', summary: 'n/a',
    requiredMessageIndexes: [], missingMessageIndexes: [],
  },
}

function props(state: ContextTaxonomyViewState): ContextTaxonomyViewProps {
  const translate = (key: string, values?: Record<string, unknown>) => {
    let value = key
    for (const [name, replacement] of Object.entries(values ?? {})) value = value.replace(`{${name}}`, String(replacement))
    return value
  }
  return {
    sessionId: 'session-fixture' as SessionId,
    useSession: selector => selector({} as never),
    useSessions: selector => selector({} as never),
    useTaxonomy: selector => selector(state),
    refresh: async () => undefined,
    select: async () => undefined,
    pauseLatest: () => undefined,
    jumpLatest: async () => undefined,
    loadRawPage: async () => undefined,
    readAllRaw: async () => '',
    t: translate,
  } as unknown as ContextTaxonomyViewProps
}

describe('ContextTaxonomyView', () => {
  it('renders an honest logical-request inspector with accessible controls', () => {
    const state: ContextTaxonomyViewState = {
      status: 'ready', captures: [capture], selectedId: captureId, followLatest: true, newerCount: 0,
      taxonomy, detailLoading: false, rawText: '', rawTotalChars: null, rawDone: false, rawLoading: false, error: null,
    }
    const html = renderToStaticMarkup(<ContextTaxonomyView {...props(state)} />)
    expect(html).toContain('source')
    expect(html).toContain('raw.title')
    expect(html).toContain('raw.note')
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('providerPayload')
    expect(html).not.toContain('wireAttempt')
  })

  it('does not invent cache values when optional usage fields are absent', () => {
    const state: ContextTaxonomyViewState = {
      status: 'ready', captures: [capture], selectedId: captureId, followLatest: true, newerCount: 0,
      taxonomy, detailLoading: false, rawText: '', rawTotalChars: null, rawDone: false, rawLoading: false, error: null,
    }
    const html = renderToStaticMarkup(<ContextTaxonomyView {...props(state)} />)
    expect(html).not.toContain('status.cache:')
    expect(html).not.toContain('status.cache.read')
    expect(html).not.toContain('status.cache.write')
  })
})
