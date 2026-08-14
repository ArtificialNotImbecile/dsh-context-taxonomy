/** Durable runtime schemas for compact capture records. */
import { z } from 'zod'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { CaptureId, CaptureRecord } from '../types.ts'

const nonNegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const optionalNonNegative = nonNegative.optional()
const categoryCounts = z.object({
  system: nonNegative,
  conversation: nonNegative,
  'current-prompt': nonNegative,
  tools: nonNegative,
  options: nonNegative,
  unclassified: nonNegative,
})
const failure = z.object({
  code: z.string().min(1),
  message: z.string(),
  status: z.number().int().min(100).max(599).optional(),
})

const observedOutcome = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stop') }),
  z.object({ kind: z.literal('tool-calls') }),
  z.object({ kind: z.literal('max-tokens') }),
  z.object({ kind: z.literal('aborted'), failure }),
  z.object({ kind: z.literal('error'), failure }),
  z.object({ kind: z.literal('unknown-finish'), providerKind: z.string() }),
  z.object({ kind: z.literal('downstream-threw'), failure }),
  z.object({ kind: z.literal('stream-ended-without-finish') }),
  z.object({ kind: z.literal('consumer-stopped') }),
])

const usage = z.object({
  inputTokens: nonNegative,
  outputTokens: nonNegative,
  cacheReadTokens: optionalNonNegative,
  cacheWriteTokens: optionalNonNegative,
  reasoningTokens: optionalNonNegative,
})

/** Runtime schema for one compact capture record. */
export const captureRecordSchema: z.ZodType<CaptureRecord> = z.object({
  formatVersion: z.literal(1),
  taxonomyVersion: z.literal(1),
  captureId: z.uuid().transform(value => value as CaptureId),
  session: z.object({
    id: z.string().min(1).transform(value => value as SessionId),
    createdAt: nonNegative,
    cwd: z.string().optional(),
  }),
  location: z.object({
    turn: nonNegative,
    step: nonNegative,
    callOrdinal: nonNegative,
    stepStartSeq: nonNegative,
  }),
  provider: z.string().min(1),
  model: z.string().min(1),
  source: z.literal('dsh-logical-call'),
  startedAt: nonNegative,
  settledAt: optionalNonNegative,
  status: z.union([z.literal('running'), z.literal('settled'), z.literal('interrupted')]),
  observedOutcome: observedOutcome.optional(),
  usage: usage.optional(),
  dshRetry: z.object({ retryId: z.string().min(1), retry: nonNegative.min(1) }).optional(),
  raw: z.object({
    state: z.union([
      z.literal('pending'), z.literal('available'), z.literal('structure-only'),
      z.literal('omitted-size-limit'), z.literal('write-failed'), z.literal('missing'), z.literal('corrupt'),
    ]),
    blobKey: z.string().min(1).optional(),
    logicalRequestHash: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
    charCount: optionalNonNegative,
    byteCount: optionalNonNegative,
    storedBytes: optionalNonNegative,
  }),
  summary: z.object({
    estimatedTokens: nonNegative,
    itemCount: nonNegative,
    estimatedByCategory: categoryCounts,
    topLevelOrder: z.array(z.string()),
    redactionCount: nonNegative,
    reasoningStatus: z.union([
      z.literal('pass'), z.literal('fail'), z.literal('not-applicable'), z.literal('unknown'),
    ]),
  }),
}) as unknown as z.ZodType<CaptureRecord>

/** One compact capture per opaque id. */
export const contextTaxonomyDomainSpec = defineDomain({
  name: 'context_taxonomy',
  version: 1,
  tables: {
    captures: domainTable<CaptureId, CaptureRecord>(captureRecordSchema),
  },
})
