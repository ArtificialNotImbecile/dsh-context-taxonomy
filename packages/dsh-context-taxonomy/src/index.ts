/** Logical-call capture, storage, and read-only Remote service for DeepSeek Harness Web. */
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { isAgentLoopRequest } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm/types'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { BackgroundQueue } from './capture/background-queue.ts'
import { SessionTracker } from './capture/session-tracker.ts'
import { observeStream, type StreamObservation } from './capture/wrap-stream.ts'
import { BlobStore } from './storage/blob-store.ts'
import { classifyLogicalRequest } from './taxonomy/classify.ts'
import { contextTaxonomyDomainSpec } from './taxonomy/schema.ts'
import {
  compileRedactKeyPatterns,
  sanitizeLogicalRequest,
  type SanitizedJson,
  type SanitizedLogicalRequest,
} from './taxonomy/sanitize.ts'
import type {
  CaptureGetRequest,
  CaptureGetResult,
  CaptureGetValue,
  CaptureId,
  CaptureListRequest,
  CaptureListResult,
  CaptureListValue,
  CaptureRawMetadata,
  CaptureRawRequest,
  CaptureRawResult,
  CaptureRawValue,
  CaptureRecord,
  CaptureRejected,
  CaptureSuccess,
  ContextTaxonomy,
  DshRetryEvidence,
  LogicalCallLocation,
} from './types.ts'

export type * from './types.ts'
export { classifyLogicalRequest } from './taxonomy/classify.ts'
export { estimateTokens, previewText } from './taxonomy/segments.ts'
export { compileRedactKeyPatterns, sanitizeLogicalRequest } from './taxonomy/sanitize.ts'
export { validateLogicalReasoning } from './taxonomy/reasoning.ts'

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 100
const MAX_RAW_PAGE_CHARS = 65_536

/** Deployment configuration. The install bundle supplies every field explicitly. */
export interface Config {
  /** Absolute private data root. */
  readonly root: string
  /** Whether sanitized content or structure-only summaries are retained. */
  readonly captureContent: 'sanitized' | 'structure-only'
  /** Maximum capture age. */
  readonly retentionDays: number
  /** Maximum rows retained per Session lifecycle. */
  readonly maxCapturesPerSession: number
  /** Maximum compressed blob bytes retained globally. */
  readonly maxStoredBytes: number
  /** Maximum sanitized UTF-8 request bytes stored for one call. */
  readonly maxCaptureBytes: number
  /** Maximum capture preparations admitted concurrently. */
  readonly maxPendingCaptures: number
  /** Additive regular-expression sources for sensitive object keys. */
  readonly extraRedactKeyPatterns: readonly string[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Read-only logical-call taxonomy sidecar. */
    contextTaxonomy: ContextTaxonomyService
  }
}

interface CaptureWorkState {
  initialDone: boolean
  observation?: StreamObservation
}

interface StoredLogicalRequest {
  readonly json: string
  readonly request: SanitizedLogicalRequest
}

/** Host service: transparent LLM observation plus sidecar Remote API. */
export class ContextTaxonomyService extends TypertRemoteService {
  static inject = ['llm', 'sessions', 'sessionPersistence', 'storageDomain']

  /** Loader-side validation and defaults for every deployment-varying policy. */
  static Config: s<Config> = s.object({
    root: s.string().required(),
    captureContent: s.union([s.const('sanitized'), s.const('structure-only')]).default('sanitized'),
    retentionDays: s.number().step(1).min(1).default(30),
    maxCapturesPerSession: s.number().step(1).min(1).default(200),
    maxStoredBytes: s.number().step(1).min(1).default(512 * 1024 * 1024),
    maxCaptureBytes: s.number().step(1).min(1).default(16 * 1024 * 1024),
    maxPendingCaptures: s.number().step(1).min(1).default(64),
    extraRedactKeyPatterns: s.array(s.string()).default([]),
  }) as s<Config>

  private readonly blobStore: BlobStore
  private readonly tracker = new SessionTracker()
  private readonly queue: BackgroundQueue
  private readonly extraRedactKeyPatterns: readonly RegExp[]
  private table?: KvTable<CaptureId, CaptureRecord>
  private accepting = true
  private readonly work = new Map<CaptureId, CaptureWorkState>()
  private readonly finalizations = new Set<Promise<void>>()
  private readonly readLeases = new Map<CaptureId, number>()
  private maintenanceTail: Promise<void> = Promise.resolve()

  /**
   * @param ctx - Host context with LLM, Session, persistence, and storage capabilities.
   * @param config - validated retention and capture policy.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'contextTaxonomy')
    this.assertConfig(config)
    this.blobStore = new BlobStore(config.root)
    this.extraRedactKeyPatterns = compileRedactKeyPatterns(config.extraRedactKeyPatterns)
    this.queue = new BackgroundQueue(config.maxPendingCaptures, error => this.warn('capture preparation failed', error))
  }

  /** Open storage, reconcile crash windows, then begin transparent observation. */
  protected async [Service.init](): Promise<void> {
    await this.blobStore.init()
    const domain = await this.ctx.storageDomain.open(contextTaxonomyDomainSpec)
    this.table = domain.table('captures')
    await this.reconcile()

    for (const session of this.ctx.sessions.list()) this.tracker.adopt(session)
    this.ctx.on('session/created', session => this.tracker.adopt(session), { global: true })
    this.ctx.on('session/event', (session, event) => this.tracker.observe(session, event), { global: true })
    this.ctx.on('session/disposed', session => this.tracker.retire(session), { global: true })
    this.ctx.on('llm/stream', (options, next): AsyncIterable<StreamChunk> => {
      if (!this.accepting || !isAgentLoopRequest(options)
        || options.sessionId === undefined || options.purpose !== undefined) return next()
      const session = this.ctx.sessions.get(options.sessionId)
      if (session === undefined) return next()
      const tracked = this.tracker.allocate(session)
      if (tracked === undefined) return next()
      const captureId = randomUUID() as CaptureId
      const startedAt = Date.now()
      let admitted = false
      return observeStream(
        next(),
        () => {
          try {
            admitted = this.beginCapture(
              captureId,
              options,
              session.header,
              tracked.location,
              tracked.dshRetry,
              startedAt,
            )
          } catch (error: unknown) {
            this.warn(`capture ${captureId} admission failed`, error)
          }
        },
        (observation) => {
          if (!admitted) return
          try {
            this.observeSettlement(captureId, observation)
          } catch (error: unknown) {
            this.warn(`capture ${captureId} observation failed`, error)
          }
        },
      )
    }, { global: true, prepend: true })

    this.ctx.effect(() => async () => {
      this.accepting = false
      await this.queue.close()
      await Promise.all(this.finalizations)
      this.work.clear()
      await this.maintenanceTail
      await domain.close()
    }, 'context-taxonomy:close')
  }

  /**
   * List lifecycle-owned captures in stable newest-first order.
   * @param request - Session, cursor, and bounded page size.
   * @param signal - Remote cancellation.
   * @returns capture page or `session-not-found`.
   */
  @Remote('list')
  async list(request: CaptureListRequest, signal: AbortSignal): Promise<CaptureListResult> {
    const header = await this.inspectHeader(request.sessionId, signal)
    if (header === undefined) return rejected({ code: 'session-not-found', sessionId: request.sessionId })
    signal.throwIfAborted()
    const limit = resolveLimit(request.limit)
    let rows = [...this.requireTable().entries()]
      .map(([, row]) => row)
      .filter(row => row.session.id === request.sessionId && sameIdentity(row, header))
      .sort(compareNewest)
    if (request.before !== undefined) {
      rows = rows.filter(row => row.startedAt < request.before!.startedAt
        || (row.startedAt === request.before!.startedAt && row.captureId < request.before!.captureId))
    }
    const selected = rows.slice(0, limit)
    const last = selected.at(-1)
    const value: CaptureListValue = Object.freeze({
      captures: Object.freeze(selected),
      ...(rows.length > selected.length && last !== undefined
        ? { next: Object.freeze({ startedAt: last.startedAt, captureId: last.captureId }) }
        : {}),
    })
    return success(value)
  }

  /**
   * Read one compact record and re-derive its taxonomy from sanitized storage.
   * @param request - Session and opaque capture identity.
   * @param signal - Remote cancellation.
   * @returns detail, or an explicit ownership failure.
   */
  @Remote('get')
  async get(request: CaptureGetRequest, signal: AbortSignal): Promise<CaptureGetResult> {
    const header = await this.inspectHeader(request.sessionId, signal)
    if (header === undefined) return rejected({ code: 'session-not-found', sessionId: request.sessionId })
    let capture = this.ownedRecord(request.sessionId, request.captureId, header)
    if (capture === undefined) return rejected({ code: 'capture-not-found', captureId: request.captureId })
    let taxonomy: ContextTaxonomy | null = null
    if (capture.raw.state === 'available') {
      const owned = capture
      const loaded = await this.withReadLease(owned.captureId, () => this.loadStored(owned, signal))
      if (loaded.ok) taxonomy = classifyLogicalRequest(loaded.value.request)
      else capture = await this.markRawState(capture, loaded.state)
    }
    const value: CaptureGetValue = Object.freeze({ capture, taxonomy })
    return success(value)
  }

  /**
   * Read a bounded character page from sanitized canonical JSON.
   * @param request - Session, capture, and page range.
   * @param signal - Remote cancellation.
   * @returns raw page or an explicit availability failure.
   */
  @Remote('readRaw')
  async readRaw(request: CaptureRawRequest, signal: AbortSignal): Promise<CaptureRawResult> {
    const header = await this.inspectHeader(request.sessionId, signal)
    if (header === undefined) return rejected({ code: 'session-not-found', sessionId: request.sessionId })
    let capture = this.ownedRecord(request.sessionId, request.captureId, header)
    if (capture === undefined) return rejected({ code: 'capture-not-found', captureId: request.captureId })
    if (capture.raw.state !== 'available') {
      if (capture.raw.state === 'corrupt') return rejected({ code: 'raw-corrupt', captureId: capture.captureId })
      return rejected({ code: 'raw-unavailable', captureId: capture.captureId, state: capture.raw.state })
    }

    const owned = capture
    const loaded = await this.withReadLease(owned.captureId, () => this.loadStored(owned, signal))
    if (!loaded.ok) {
      capture = await this.markRawState(capture, loaded.state)
      return loaded.state === 'corrupt'
        ? rejected({ code: 'raw-corrupt', captureId: capture.captureId })
        : rejected({ code: 'raw-unavailable', captureId: capture.captureId, state: loaded.state })
    }
    const offset = Math.min(
      loaded.value.json.length,
      Math.max(0, Number.isSafeInteger(request.offset) ? request.offset : 0),
    )
    const length = Math.min(MAX_RAW_PAGE_CHARS, Math.max(1, Number.isSafeInteger(request.length) ? request.length : MAX_RAW_PAGE_CHARS))
    const nextOffset = Math.min(loaded.value.json.length, offset + length)
    const value: CaptureRawValue = Object.freeze({
      text: loaded.value.json.slice(offset, nextOffset),
      offset,
      nextOffset,
      done: nextOffset >= loaded.value.json.length,
      totalChars: loaded.value.json.length,
      logicalRequestHash: loaded.value.request.logicalRequestHash,
    })
    return success(value)
  }

  private beginCapture(
    captureId: CaptureId,
    options: GenerateOptions,
    header: SessionHeader,
    location: LogicalCallLocation,
    dshRetry: DshRetryEvidence | undefined,
    startedAt: number,
  ): boolean {
    if (!this.accepting) return false
    const state: CaptureWorkState = { initialDone: false }
    this.work.set(captureId, state)
    const admitted = this.queue.add(async () => {
      try {
        await this.persistInitial(captureId, options, header, location, dshRetry, startedAt)
      } finally {
        state.initialDone = true
        this.maybeFinalize(captureId, state)
      }
    })
    if (!admitted) {
      this.work.delete(captureId)
      this.ctx.logger.warn(`context-taxonomy: capture queue full (${this.config.maxPendingCaptures}); logical call omitted`)
    }
    return admitted
  }

  private observeSettlement(captureId: CaptureId, observation: StreamObservation): void {
    if (!this.accepting) return
    const state = this.work.get(captureId)
    if (state === undefined) return
    state.observation = observation
    this.maybeFinalize(captureId, state)
  }

  private maybeFinalize(captureId: CaptureId, state: CaptureWorkState): void {
    if (!state.initialDone || state.observation === undefined) return
    this.work.delete(captureId)
    const operation = this.persistSettlement(captureId, state.observation)
      .catch(error => this.warn(`capture ${captureId} settlement failed`, error))
    this.finalizations.add(operation)
    void operation.finally(() => this.finalizations.delete(operation))
  }

  private async persistInitial(
    captureId: CaptureId,
    options: GenerateOptions,
    header: SessionHeader,
    location: LogicalCallLocation,
    dshRetry: DshRetryEvidence | undefined,
    startedAt: number,
  ): Promise<void> {
    const sanitized = sanitizeLogicalRequest(options, this.extraRedactKeyPatterns)
    const taxonomy = classifyLogicalRequest(sanitized)
    let raw: CaptureRawMetadata
    if (this.config.captureContent === 'structure-only') {
      raw = Object.freeze({ state: 'structure-only' })
    } else if (sanitized.byteCount > this.config.maxCaptureBytes) {
      raw = Object.freeze({
        state: 'omitted-size-limit',
        logicalRequestHash: sanitized.logicalRequestHash,
        charCount: sanitized.json.length,
        byteCount: sanitized.byteCount,
      })
    } else {
      try {
        const stored = await this.blobStore.write(captureId, sanitized.json)
        raw = Object.freeze({
          state: 'available',
          blobKey: stored.blobKey,
          logicalRequestHash: sanitized.logicalRequestHash,
          charCount: sanitized.json.length,
          byteCount: sanitized.byteCount,
          storedBytes: stored.storedBytes,
        })
      } catch (error: unknown) {
        this.warn(`capture ${captureId} blob write failed`, error)
        raw = Object.freeze({
          state: 'write-failed',
          logicalRequestHash: sanitized.logicalRequestHash,
          charCount: sanitized.json.length,
          byteCount: sanitized.byteCount,
        })
      }
    }

    const estimatedTokens = Object.values(taxonomy.estimatedByCategory).reduce((sum, count) => sum + count, 0)
    const row = freezeDeep({
      formatVersion: 1,
      taxonomyVersion: 1,
      captureId,
      session: {
        id: header.id,
        createdAt: header.createdAt,
        ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
      },
      location,
      provider: options.provider,
      model: options.model,
      source: 'dsh-logical-call',
      startedAt,
      status: 'running',
      ...(dshRetry === undefined ? {} : { dshRetry }),
      raw,
      summary: {
        estimatedTokens,
        itemCount: taxonomy.items.length,
        estimatedByCategory: taxonomy.estimatedByCategory,
        topLevelOrder: taxonomy.topLevelOrder,
        redactionCount: taxonomy.redactionCount,
        reasoningStatus: taxonomy.reasoning.status,
      },
    } satisfies CaptureRecord)
    await this.requireTable().put(captureId, row)
  }

  private async persistSettlement(captureId: CaptureId, observation: StreamObservation): Promise<void> {
    const table = this.requireTable()
    const current = table.get(captureId)
    if (current === undefined) return
    const interrupted = observation.observedOutcome.kind === 'consumer-stopped'
      || observation.observedOutcome.kind === 'stream-ended-without-finish'
    await table.put(captureId, freezeDeep({
      ...current,
      status: interrupted ? 'interrupted' : 'settled',
      settledAt: Date.now(),
      observedOutcome: observation.observedOutcome,
      ...(observation.usage === undefined ? {} : { usage: observation.usage }),
    } satisfies CaptureRecord))
    await this.scheduleMaintenance()
  }

  private async reconcile(): Promise<void> {
    const table = this.requireTable()
    const now = Date.now()
    await this.blobStore.pruneTemps()
    for (const [captureId, row] of table.entries()) {
      let next = row
      if (next.status === 'running') {
        next = freezeDeep({ ...next, status: 'interrupted', settledAt: now } satisfies CaptureRecord)
      }
      if (next.raw.state === 'available' && next.raw.blobKey !== undefined
        && !await this.blobStore.exists(next.raw.blobKey)) {
        next = freezeDeep({ ...next, raw: { ...next.raw, state: 'missing' } } satisfies CaptureRecord)
      }
      if (next !== row) await table.put(captureId, next)
    }
    const referenced = new Set([...table.entries()].flatMap(([, row]) => row.raw.blobKey === undefined ? [] : [row.raw.blobKey]))
    for (const blobKey of await this.blobStore.list()) {
      if (!referenced.has(blobKey)) await this.blobStore.delete(blobKey)
    }
    await this.runMaintenance()
  }

  private scheduleMaintenance(): Promise<void> {
    const operation = this.maintenanceTail.then(() => this.runMaintenance())
    this.maintenanceTail = operation.catch(error => this.warn('retention failed', error))
    return operation
  }

  private async runMaintenance(): Promise<void> {
    const table = this.requireTable()
    const rows = [...table.entries()].map(([, row]) => row).filter(row => row.status !== 'running')
    const remove = new Set<CaptureId>()
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
    for (const row of rows) if (row.startedAt < cutoff) remove.add(row.captureId)

    const perSession = new Map<string, CaptureRecord[]>()
    for (const row of rows) {
      const key = `${row.session.id}\0${row.session.createdAt}\0${row.session.cwd ?? ''}`
      const group = perSession.get(key) ?? []
      group.push(row)
      perSession.set(key, group)
    }
    for (const group of perSession.values()) {
      group.sort(compareNewest)
      for (const row of group.slice(this.config.maxCapturesPerSession)) remove.add(row.captureId)
    }

    let storedBytes = rows.reduce((sum, row) => sum + (row.raw.storedBytes ?? 0), 0)
    for (const row of [...rows].sort(compareOldest)) {
      if (storedBytes <= this.config.maxStoredBytes) break
      if (!remove.has(row.captureId)) remove.add(row.captureId)
      storedBytes -= row.raw.storedBytes ?? 0
    }

    for (const captureId of remove) {
      if ((this.readLeases.get(captureId) ?? 0) > 0) continue
      const row = table.get(captureId)
      if (row === undefined) continue
      await table.delete(captureId)
      if (row.raw.blobKey !== undefined) {
        await this.blobStore.delete(row.raw.blobKey).catch(error => this.warn(`orphan cleanup failed for ${captureId}`, error))
      }
    }
  }

  private async inspectHeader(sessionId: SessionId, signal: AbortSignal): Promise<SessionHeader | undefined> {
    signal.throwIfAborted()
    if (this.ctx.sessions.get(sessionId) === undefined) {
      const snapshots = await this.ctx.sessionPersistence.listSnapshots(signal)
      if (!snapshots.some(snapshot => snapshot.header.id === sessionId)
        && this.ctx.sessions.get(sessionId) === undefined) return
    }
    return (await this.ctx.sessionPersistence.inspect(sessionId, signal)).meta
  }

  private ownedRecord(sessionId: SessionId, captureId: CaptureId, header: SessionHeader): CaptureRecord | undefined {
    const row = this.requireTable().get(captureId)
    return row?.session.id === sessionId && sameIdentity(row, header) ? row : undefined
  }

  private async loadStored(
    capture: CaptureRecord,
    signal: AbortSignal,
  ): Promise<{ readonly ok: true; readonly value: StoredLogicalRequest } | { readonly ok: false; readonly state: 'missing' | 'corrupt' }> {
    const { blobKey, logicalRequestHash } = capture.raw
    if (blobKey === undefined || logicalRequestHash === undefined) return { ok: false, state: 'corrupt' }
    signal.throwIfAborted()
    if (!await this.blobStore.exists(blobKey)) return { ok: false, state: 'missing' }
    try {
      const json = await this.blobStore.read(blobKey)
      signal.throwIfAborted()
      if (createHash('sha256').update(json).digest('hex') !== logicalRequestHash
        || Buffer.byteLength(json, 'utf8') > this.config.maxCaptureBytes) return { ok: false, state: 'corrupt' }
      const parsed: unknown = JSON.parse(json)
      if (!isSanitizedRecord(parsed)) return { ok: false, state: 'corrupt' }
      const request: SanitizedLogicalRequest = Object.freeze({
        value: Object.freeze(parsed),
        json,
        logicalRequestHash,
        byteCount: Buffer.byteLength(json, 'utf8'),
        redactionCount: capture.summary.redactionCount,
      })
      return { ok: true, value: Object.freeze({ json, request }) }
    } catch (error: unknown) {
      if (signal.aborted) throw error
      return { ok: false, state: 'corrupt' }
    }
  }

  private async markRawState(capture: CaptureRecord, state: 'missing' | 'corrupt'): Promise<CaptureRecord> {
    if (capture.raw.state === state) return capture
    const next = freezeDeep({ ...capture, raw: { ...capture.raw, state } } satisfies CaptureRecord)
    await this.requireTable().put(capture.captureId, next)
    return next
  }

  private async withReadLease<T>(captureId: CaptureId, read: () => Promise<T>): Promise<T> {
    this.readLeases.set(captureId, (this.readLeases.get(captureId) ?? 0) + 1)
    try {
      return await read()
    } finally {
      const remaining = (this.readLeases.get(captureId) ?? 1) - 1
      if (remaining === 0) this.readLeases.delete(captureId)
      else this.readLeases.set(captureId, remaining)
    }
  }

  private requireTable(): KvTable<CaptureId, CaptureRecord> {
    if (this.table === undefined) throw new Error('context-taxonomy: storage domain is not initialized')
    return this.table
  }

  private assertConfig(config: Config): void {
    for (const [name, value] of Object.entries({
      retentionDays: config.retentionDays,
      maxCapturesPerSession: config.maxCapturesPerSession,
      maxStoredBytes: config.maxStoredBytes,
      maxCaptureBytes: config.maxCaptureBytes,
      maxPendingCaptures: config.maxPendingCaptures,
    })) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`context-taxonomy: ${name} must be a positive safe integer`)
      }
    }
  }

  private warn(context: string, error: unknown): void {
    this.ctx.logger.warn(`context-taxonomy: ${context}: ${String(error)}`)
  }
}

function resolveLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIST_LIMIT
  if (!Number.isFinite(value)) return DEFAULT_LIST_LIMIT
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.trunc(value)))
}

function compareNewest(left: CaptureRecord, right: CaptureRecord): number {
  return right.startedAt - left.startedAt || right.captureId.localeCompare(left.captureId)
}

function compareOldest(left: CaptureRecord, right: CaptureRecord): number {
  return left.startedAt - right.startedAt || left.captureId.localeCompare(right.captureId)
}

function sameIdentity(row: CaptureRecord, header: SessionHeader): boolean {
  return row.session.createdAt === header.createdAt && row.session.cwd === header.cwd
}

function success<T>(value: T): CaptureSuccess<T> {
  return Object.freeze({ ok: true, value })
}

function rejected<E>(error: E): CaptureRejected<E> {
  return Object.freeze({ ok: false, error: Object.freeze(error) })
}

function isSanitizedRecord(value: unknown): value is Record<string, SanitizedJson> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const seen = new WeakSet<object>()
  const pending: object[] = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || seen.has(current)) continue
    seen.add(current)
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === 'object') pending.push(child)
    }
    Object.freeze(current)
  }
  return value
}

export default ContextTaxonomyService
