import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { CaptureId, CaptureRecord, ContextTaxonomy } from '../src/types.ts'
import {
  ContextTaxonomyController,
  type ContextTaxonomyRemote,
} from '../src/client/controller.ts'

const SESSION_ID = 'session-fixture' as SessionId

function capture(id: string, startedAt: number, callOrdinal: number, status: CaptureRecord['status'] = 'settled'): CaptureRecord {
  return {
    formatVersion: 1,
    taxonomyVersion: 1,
    captureId: id as CaptureId,
    session: { id: SESSION_ID, createdAt: 1 },
    location: { turn: 1, step: 1, callOrdinal, stepStartSeq: 2 },
    provider: 'deepseek',
    model: 'deepseek-chat',
    source: 'dsh-logical-call',
    startedAt,
    status,
    raw: { state: 'available', logicalRequestHash: 'a'.repeat(64) },
    summary: {
      estimatedTokens: 10,
      itemCount: 0,
      estimatedByCategory: {
        system: 0, conversation: 0, 'current-prompt': 0, tools: 0, options: 10, unclassified: 0,
      },
      topLevelOrder: ['provider', 'model', 'messages'],
      redactionCount: 0,
      reasoningStatus: 'not-applicable',
    },
  }
}

const EMPTY_TAXONOMY: ContextTaxonomy = {
  taxonomyVersion: 1,
  source: 'dsh-logical-call',
  provider: 'deepseek',
  model: 'deepseek-chat',
  topLevelOrder: ['provider', 'model', 'messages'],
  items: [],
  estimatedByCategory: {
    system: 0, conversation: 0, 'current-prompt': 0, tools: 0, options: 0, unclassified: 0,
  },
  redactionCount: 0,
  reasoning: {
    status: 'not-applicable',
    policyId: 'deepseek-logical-tool-interval-v1',
    summary: 'No tool calls.',
    requiredMessageIndexes: [],
    missingMessageIndexes: [],
  },
}

describe('ContextTaxonomyController', () => {
  it('follows newest until the user selects history, then counts newer calls', async () => {
    const old = capture('123e4567-e89b-42d3-a456-426614174001', 10, 0)
    const newest = capture('123e4567-e89b-42d3-a456-426614174002', 20, 1)
    let captures = [old]
    const remote: ContextTaxonomyRemote = {
      list: async () => ({ ok: true, value: { ok: true, value: { captures } } }),
      get: async request => ({
        ok: true,
        value: { ok: true, value: { capture: captures.find(row => row.captureId === request.captureId)!, taxonomy: EMPTY_TAXONOMY } },
      }),
      readRaw: async () => ({ ok: true, value: { ok: false, error: { code: 'raw-unavailable', captureId: old.captureId, state: 'missing' } } }),
    }
    const controller = new ContextTaxonomyController(remote, SESSION_ID)

    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ selectedId: old.captureId, followLatest: true, newerCount: 0 })
    controller.pauseLatest()
    captures = [newest, old]
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ selectedId: old.captureId, followLatest: false, newerCount: 1 })
    await controller.jumpLatest()
    expect(controller.getSnapshot()).toMatchObject({ selectedId: newest.captureId, followLatest: true, newerCount: 0 })
    controller.dispose()
  })

  it('loads bounded raw pages to completion', async () => {
    const row = capture('123e4567-e89b-42d3-a456-426614174003', 10, 0)
    const text = '{"safe":"logical request"}'
    const remote: ContextTaxonomyRemote = {
      list: async () => ({ ok: true, value: { ok: true, value: { captures: [row] } } }),
      get: async () => ({ ok: true, value: { ok: true, value: { capture: row, taxonomy: EMPTY_TAXONOMY } } }),
      readRaw: async request => {
        const nextOffset = Math.min(text.length, request.offset + 6)
        return { ok: true, value: { ok: true, value: {
          text: text.slice(request.offset, nextOffset),
          offset: request.offset,
          nextOffset,
          done: nextOffset === text.length,
          totalChars: text.length,
          logicalRequestHash: 'a'.repeat(64),
        } } }
      },
    }
    const controller = new ContextTaxonomyController(remote, SESSION_ID)
    await controller.refresh()
    expect(await controller.readAllRaw()).toBe(text)
    expect(controller.getSnapshot()).toMatchObject({ rawDone: true, rawTotalChars: text.length })
    controller.dispose()
  })

  it('adopts detail-side raw repairs and expected raw failures without hiding the inspector', async () => {
    const row = capture('123e4567-e89b-42d3-a456-426614174005', 10, 0)
    const repaired = { ...row, raw: { ...row.raw, state: 'missing' as const } }
    const remote: ContextTaxonomyRemote = {
      list: async () => ({ ok: true, value: { ok: true, value: { captures: [row] } } }),
      get: async () => ({ ok: true, value: { ok: true, value: { capture: repaired, taxonomy: null } } }),
      readRaw: async () => ({ ok: true, value: {
        ok: false,
        error: { code: 'raw-unavailable', captureId: row.captureId, state: 'missing' },
      } }),
    }
    const controller = new ContextTaxonomyController(remote, SESSION_ID)

    await controller.refresh()
    await controller.loadRawPage()

    expect(controller.getSnapshot().captures[0]?.raw.state).toBe('missing')
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', error: null })
    controller.dispose()
  })
})
