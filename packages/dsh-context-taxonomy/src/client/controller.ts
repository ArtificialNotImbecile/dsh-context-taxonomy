/** Per-Session browser object layer over the read-only Context Taxonomy Remote. */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CaptureGetResult, CaptureId, CaptureListResult, CaptureRawResult,
  CaptureRecord, ContextTaxonomy,
} from '../types.ts'

/** Generated Remote methods consumed by this UI. */
export interface ContextTaxonomyRemote {
  list(request: { sessionId: SessionId; limit?: number }, signal?: AbortSignal): Promise<RemoteResult<CaptureListResult>>
  get(request: { sessionId: SessionId; captureId: CaptureId }, signal?: AbortSignal): Promise<RemoteResult<CaptureGetResult>>
  readRaw(request: {
    sessionId: SessionId
    captureId: CaptureId
    offset: number
    length: number
  }, signal?: AbortSignal): Promise<RemoteResult<CaptureRawResult>>
}

/** Immutable controller state projected into React. */
export interface ContextTaxonomyViewState {
  readonly status: 'cold' | 'loading' | 'ready' | 'error'
  readonly captures: readonly CaptureRecord[]
  readonly selectedId: CaptureId | null
  readonly followLatest: boolean
  readonly newerCount: number
  readonly taxonomy: ContextTaxonomy | null
  readonly detailLoading: boolean
  readonly rawText: string
  readonly rawTotalChars: number | null
  readonly rawDone: boolean
  readonly rawLoading: boolean
  readonly error: string | null
}

const INITIAL: ContextTaxonomyViewState = Object.freeze({
  status: 'cold', captures: Object.freeze([]), selectedId: null, followLatest: true, newerCount: 0, taxonomy: null,
  detailLoading: false, rawText: '', rawTotalChars: null, rawDone: false, rawLoading: false, error: null,
})

/** Session-scoped controller with abort and stale-generation fencing. */
export class ContextTaxonomyController implements HostObservable<ContextTaxonomyViewState> {
  private view = INITIAL
  private readonly listeners = new Set<() => void>()
  private listGeneration = 0
  private detailGeneration = 0
  private rawGeneration = 0
  private listAbort?: AbortController
  private detailAbort?: AbortController
  private rawAbort?: AbortController
  private followLatest = true
  private disposed = false
  private pollTimer?: ReturnType<typeof setTimeout>

  /** @param remote - mounted generated Remote namespace. @param sessionId - owning Session. */
  constructor(private readonly remote: ContextTaxonomyRemote, private readonly sessionId: SessionId) {}

  /** Current immutable view. */
  getSnapshot = (): ContextTaxonomyViewState => this.view

  /** Subscribe to view replacement. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Load or refresh the newest page. */
  async refresh(): Promise<void> {
    if (this.disposed) return
    const generation = ++this.listGeneration
    this.listAbort?.abort()
    const abort = new AbortController()
    this.listAbort = abort
    this.publish({ ...this.view, status: this.view.status === 'ready' ? 'ready' : 'loading', error: null })
    try {
      const remote = await this.remote.list({ sessionId: this.sessionId, limit: 100 }, abort.signal)
      if (this.staleList(generation, abort)) return
      if (!remote.ok) return this.fail(remote.error.message)
      if (!remote.value.ok) return this.fail(remote.value.error.code)
      const captures = remote.value.value.captures
      const previousSelectedId = this.view.selectedId
      const selectedIndex = previousSelectedId === null
        ? -1
        : captures.findIndex(row => row.captureId === previousSelectedId)
      if (!this.followLatest && previousSelectedId !== null && selectedIndex < 0) this.followLatest = true
      const selectedId = this.followLatest || previousSelectedId === null
        ? captures[0]?.captureId ?? null
        : previousSelectedId
      const newerCount = this.followLatest || selectedId === null
        ? 0
        : Math.max(0, captures.findIndex(row => row.captureId === selectedId))
      this.publish({
        ...this.view,
        status: 'ready',
        captures,
        selectedId,
        followLatest: this.followLatest,
        newerCount,
        ...(selectedId === null
          ? { taxonomy: null, rawText: '', rawTotalChars: null, rawDone: false, rawLoading: false }
          : {}),
        error: null,
      })
      if (selectedId !== null && (selectedId !== previousSelectedId || this.view.taxonomy === null)) {
        await this.select(selectedId, this.followLatest)
      }
      this.schedulePoll()
    } catch (error: unknown) {
      if (!this.staleList(generation, abort)) this.fail(String(error))
    }
  }

  /** Select one capture and load its derived taxonomy. */
  async select(captureId: CaptureId, followLatest = false): Promise<void> {
    if (this.disposed) return
    this.followLatest = followLatest
    const generation = ++this.detailGeneration
    this.detailAbort?.abort()
    this.rawAbort?.abort()
    this.rawGeneration++
    const abort = new AbortController()
    this.detailAbort = abort
    const selectedIndex = this.view.captures.findIndex(row => row.captureId === captureId)
    this.publish({
      ...this.view,
      selectedId: captureId,
      followLatest,
      newerCount: followLatest ? 0 : Math.max(0, selectedIndex),
      taxonomy: null,
      detailLoading: true,
      rawText: '',
      rawTotalChars: null,
      rawDone: false,
      rawLoading: false,
      error: null,
    })
    try {
      const remote = await this.remote.get({ sessionId: this.sessionId, captureId }, abort.signal)
      if (this.staleDetail(generation, abort)) return
      if (!remote.ok) return this.fail(remote.error.message)
      if (!remote.value.ok) return this.fail(remote.value.error.code)
      const detail = remote.value.value
      this.publish({
        ...this.view,
        captures: this.view.captures.map(capture => capture.captureId === detail.capture.captureId
          ? detail.capture
          : capture),
        detailLoading: false,
        taxonomy: detail.taxonomy,
      })
    } catch (error: unknown) {
      if (!this.staleDetail(generation, abort)) this.fail(String(error))
    }
  }

  /** Resume automatic selection of the newest logical call. */
  async jumpLatest(): Promise<void> {
    this.followLatest = true
    const latest = this.view.captures[0]
    if (latest !== undefined) await this.select(latest.captureId, true)
  }

  /** Pin the currently selected call before a newer call arrives. */
  pauseLatest(): void {
    if (this.disposed || this.view.selectedId === null) return
    this.followLatest = false
    this.publish({ ...this.view, followLatest: false, newerCount: 0 })
  }

  /** Load the next sanitized JSON page. */
  async loadRawPage(): Promise<void> {
    const captureId = this.view.selectedId
    if (this.disposed || captureId === null || this.view.rawLoading || this.view.rawDone) return
    const generation = this.rawGeneration
    const abort = new AbortController()
    this.rawAbort = abort
    this.publish({ ...this.view, rawLoading: true })
    try {
      const remote = await this.remote.readRaw({
        sessionId: this.sessionId,
        captureId,
        offset: this.view.rawText.length,
        length: 65_536,
      }, abort.signal)
      if (this.staleRaw(generation, abort)) return
      if (!remote.ok) return this.fail(remote.error.message)
      if (!remote.value.ok) {
        const failure = remote.value.error
        if (failure.code === 'raw-corrupt') {
          this.markSelectedRaw('corrupt')
          return
        }
        if (failure.code === 'raw-unavailable') {
          this.markSelectedRaw(failure.state)
          return
        }
        return this.fail(failure.code)
      }
      this.publish({
        ...this.view,
        rawText: this.view.rawText + remote.value.value.text,
        rawTotalChars: remote.value.value.totalChars,
        rawDone: remote.value.value.done,
        rawLoading: false,
      })
    } catch (error: unknown) {
      if (!this.staleRaw(generation, abort)) this.fail(String(error))
    }
  }

  /** Load every remaining page then return the complete sanitized JSON. */
  async readAllRaw(): Promise<string> {
    while (!this.view.rawDone && this.view.selectedId !== null && !this.disposed) {
      const before = this.view.rawText.length
      await this.loadRawPage()
      if (this.view.error !== null) throw new Error(this.view.error)
      if (!this.view.rawDone && this.view.rawText.length === before) {
        throw new Error('context-taxonomy: raw pagination made no progress')
      }
    }
    return this.view.rawText
  }

  /** Cancel work and stop polling. */
  dispose(): void {
    this.disposed = true
    this.listAbort?.abort()
    this.detailAbort?.abort()
    this.rawAbort?.abort()
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    this.listeners.clear()
  }

  /** Cancel stale detail/raw reads after a carrier reset and reload the list. */
  reset(): void {
    if (this.disposed) return
    this.detailAbort?.abort()
    this.rawAbort?.abort()
    this.detailGeneration++
    this.rawGeneration++
    this.publish({
      ...this.view,
      taxonomy: null,
      detailLoading: false,
      rawText: '',
      rawTotalChars: null,
      rawDone: false,
      rawLoading: false,
      error: null,
    })
    void this.refresh()
  }

  private schedulePoll(): void {
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    if (this.view.captures.some(capture => capture.status === 'running')) {
      this.pollTimer = setTimeout(() => void this.refresh(), 1_000)
    }
  }

  private staleList(generation: number, abort: AbortController): boolean {
    return this.disposed || generation !== this.listGeneration || abort.signal.aborted
  }

  private staleDetail(generation: number, abort: AbortController): boolean {
    return this.disposed || generation !== this.detailGeneration || abort.signal.aborted
  }

  private staleRaw(generation: number, abort: AbortController): boolean {
    return this.disposed || generation !== this.rawGeneration || abort.signal.aborted
  }

  private fail(message: string): void {
    this.publish({ ...this.view, status: 'error', detailLoading: false, rawLoading: false, error: message })
  }

  private markSelectedRaw(state: CaptureRecord['raw']['state']): void {
    const selectedId = this.view.selectedId
    this.publish({
      ...this.view,
      captures: this.view.captures.map(capture => capture.captureId === selectedId
        ? { ...capture, raw: { ...capture.raw, state } }
        : capture),
      rawLoading: false,
      error: null,
    })
  }

  private publish(view: ContextTaxonomyViewState): void {
    if (this.disposed) return
    this.view = Object.freeze(view)
    for (const listener of this.listeners) listener()
  }
}
