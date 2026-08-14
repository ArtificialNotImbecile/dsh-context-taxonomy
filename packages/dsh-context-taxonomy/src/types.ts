/** Client-safe Context Taxonomy protocol values. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { ContextForm } from '@deepseek-ai/dsh-llm/message'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Opaque identity for one observed logical-call invocation. */
export type CaptureId = Branded<'ContextTaxonomyCaptureId'>

/** Storage and RPC format version. */
export type ContextTaxonomyFormatVersion = 1

/** Classifier vocabulary version. */
export type ContextTaxonomyVersion = 1

/** User-facing logical-request sections. */
export type TaxonomyCategory =
  | 'system'
  | 'conversation'
  | 'current-prompt'
  | 'tools'
  | 'options'
  | 'unclassified'

/** Classified content inside one logical-request item. */
export interface TaxonomyPart {
  /** Stable order inside the parent item. */
  readonly order: number
  /** Semantic block kind. */
  readonly kind: 'text' | 'reasoning' | 'tool-call' | 'tool-result' | 'attachment' | 'metadata' | 'unclassified'
  /** Short display label. */
  readonly label: string
  /** JSONPath-like location inside the sanitized logical request. */
  readonly path: string
  /** Content format for presentation. */
  readonly format: 'text' | 'markdown' | 'json'
  /** Estimated tokens; provider usage remains authoritative for the call total. */
  readonly estimatedTokens: number
  /** Sanitized textual representation. */
  readonly text: string
}

/** One classified logical-request item. */
export interface TaxonomyItem {
  /** Stable order across all sections. */
  readonly order: number
  /** Owning user-facing section. */
  readonly category: TaxonomyCategory
  /** Message role or synthetic item role. */
  readonly role: string
  /** Producer identity from `MessageSource.kind`, when present. */
  readonly sourceKind?: string
  /** Producer-declared semantic form, when present. */
  readonly contextForm?: ContextForm
  /** Short display label. */
  readonly label: string
  /** JSONPath-like location inside the sanitized logical request. */
  readonly path: string
  /** Estimated tokens; used only for composition. */
  readonly estimatedTokens: number
  /** One-line sanitized preview. */
  readonly preview: string
  /** Ordered classified parts. */
  readonly parts: readonly TaxonomyPart[]
}

/** Logical DeepSeek reasoning-retention check. */
export interface LogicalReasoningCheck {
  /** Check result over the Harness logical messages. */
  readonly status: 'pass' | 'fail' | 'not-applicable' | 'unknown'
  /** Stable local policy id. */
  readonly policyId: 'deepseek-logical-tool-interval-v1' | 'unknown'
  /** Honest user-facing interpretation. */
  readonly summary: string
  /** Message indexes whose tool-call reasoning is required by the logical check. */
  readonly requiredMessageIndexes: readonly number[]
  /** Required message indexes with no non-empty reasoning block. */
  readonly missingMessageIndexes: readonly number[]
}

/** Derived taxonomy for one sanitized Harness logical request. */
export interface ContextTaxonomy {
  /** Classifier vocabulary version. */
  readonly taxonomyVersion: ContextTaxonomyVersion
  /** Fixed observation source; never a provider-wire claim. */
  readonly source: 'dsh-logical-call'
  /** Provider route selected by Harness. */
  readonly provider: string
  /** Provider model selected by Harness. */
  readonly model: string
  /** Stable top-level key order in the sanitized logical request. */
  readonly topLevelOrder: readonly string[]
  /** Ordered classified items. */
  readonly items: readonly TaxonomyItem[]
  /** Estimated tokens grouped by section. */
  readonly estimatedByCategory: Readonly<Record<TaxonomyCategory, number>>
  /** Number of sanitized values replaced by mandatory redaction. */
  readonly redactionCount: number
  /** Logical-only DeepSeek reasoning check. */
  readonly reasoning: LogicalReasoningCheck
}

/** Stored Session fields that fence captures to one lifecycle. */
export interface CaptureSessionIdentity {
  /** Owning Session id. */
  readonly id: SessionId
  /** Session creation time. */
  readonly createdAt: number
  /** Session working directory, when present. */
  readonly cwd?: string
}

/** Plugin-local location of one logical call. */
export interface LogicalCallLocation {
  /** Open turn at observation time. */
  readonly turn: number
  /** Open step at observation time. */
  readonly step: number
  /** Zero-based logical-call ordinal within the step. */
  readonly callOrdinal: number
  /** Sequence number of the matching `step/start`. */
  readonly stepStartSeq: number
}

/** Durable retry evidence emitted by the official retry plugin. */
export interface DshRetryEvidence {
  /** Opaque official retry-chain id. */
  readonly retryId: string
  /** One-based retry number; the initial call has no evidence. */
  readonly retry: number
}

/** Observed downstream completion, not proof of provider transport delivery. */
export type ObservedOutcome =
  | { readonly kind: 'stop' | 'tool-calls' | 'max-tokens' }
  | { readonly kind: 'aborted' | 'error'; readonly failure: CaptureFailure }
  | { readonly kind: 'unknown-finish'; readonly providerKind: string }
  | { readonly kind: 'downstream-threw'; readonly failure: CaptureFailure }
  | { readonly kind: 'stream-ended-without-finish' }
  | { readonly kind: 'consumer-stopped' }

/** Serializable failure details safe for the sidecar UI. */
export interface CaptureFailure {
  /** Stable or normalized failure code. */
  readonly code: string
  /** Human-readable failure message. */
  readonly message: string
  /** HTTP status when the downstream failure disclosed one. */
  readonly status?: number
}

/** Sanitized logical-request blob state. */
export type CaptureRawState =
  | 'pending'
  | 'available'
  | 'structure-only'
  | 'omitted-size-limit'
  | 'write-failed'
  | 'missing'
  | 'corrupt'

/** Raw blob metadata stored in the compact index. */
export interface CaptureRawMetadata {
  /** Current blob state. */
  readonly state: CaptureRawState
  /** Relative opaque blob key for available data. */
  readonly blobKey?: string
  /** SHA-256 of the sanitized canonical JSON. */
  readonly logicalRequestHash?: string
  /** UTF-16 string length of the canonical JSON. */
  readonly charCount?: number
  /** UTF-8 byte length before compression. */
  readonly byteCount?: number
  /** Gzip bytes stored on disk. */
  readonly storedBytes?: number
}

/** Compact derived composition summary. */
export interface CaptureSummary {
  /** Estimated tokens across classified request content. */
  readonly estimatedTokens: number
  /** Number of classified items. */
  readonly itemCount: number
  /** Estimated tokens grouped by section. */
  readonly estimatedByCategory: Readonly<Record<TaxonomyCategory, number>>
  /** Sanitized top-level key order. */
  readonly topLevelOrder: readonly string[]
  /** Mandatory redaction replacements. */
  readonly redactionCount: number
  /** Logical DeepSeek reasoning check status. */
  readonly reasoningStatus: LogicalReasoningCheck['status']
}

/** Durable compact record for one observed logical-call invocation. */
export interface CaptureRecord {
  /** RPC/storage format version. */
  readonly formatVersion: ContextTaxonomyFormatVersion
  /** Classifier vocabulary version. */
  readonly taxonomyVersion: ContextTaxonomyVersion
  /** Opaque capture id. */
  readonly captureId: CaptureId
  /** Owning Session lifecycle. */
  readonly session: CaptureSessionIdentity
  /** Turn, step, and plugin-local call ordinal. */
  readonly location: LogicalCallLocation
  /** Provider route selected by Harness. */
  readonly provider: string
  /** Provider model selected by Harness. */
  readonly model: string
  /** Fixed observation source. */
  readonly source: 'dsh-logical-call'
  /** Observation start time in Unix epoch milliseconds. */
  readonly startedAt: number
  /** Finalization time when no longer running. */
  readonly settledAt?: number
  /** Capture lifecycle, independent of model success. */
  readonly status: 'running' | 'settled' | 'interrupted'
  /** Downstream result observed by the transparent wrapper. */
  readonly observedOutcome?: ObservedOutcome
  /** Last usage chunk observed downstream. */
  readonly usage?: TokenUsage
  /** Retry number only when the official durable event proves it. */
  readonly dshRetry?: DshRetryEvidence
  /** Sanitized canonical blob metadata. */
  readonly raw: CaptureRawMetadata
  /** Compact taxonomy summary. */
  readonly summary: CaptureSummary
}

/** Stable descending-list cursor. */
export interface CaptureCursor {
  /** Start time of the last returned row. */
  readonly startedAt: number
  /** Capture id breaking equal-time ties. */
  readonly captureId: CaptureId
}

/** Read captures for one Session. */
export interface CaptureListRequest {
  /** Owning Session. */
  readonly sessionId: SessionId
  /** Exclusive descending cursor. */
  readonly before?: CaptureCursor
  /** Requested page size; Host clamps to 100. */
  readonly limit?: number
}

/** Read one capture detail. */
export interface CaptureGetRequest {
  /** Owning Session. */
  readonly sessionId: SessionId
  /** Capture to read. */
  readonly captureId: CaptureId
}

/** Read a page of sanitized canonical JSON. */
export interface CaptureRawRequest extends CaptureGetRequest {
  /** UTF-16 character offset. */
  readonly offset: number
  /** Requested character count; Host clamps to 65,536. */
  readonly length: number
}

/** No current persisted Session owns the request. */
export interface SessionNotFoundFailure {
  readonly code: 'session-not-found'
  readonly sessionId: SessionId
}

/** No capture belongs to the requested Session lifecycle. */
export interface CaptureNotFoundFailure {
  readonly code: 'capture-not-found'
  readonly captureId: CaptureId
}

/** The requested raw state has no readable blob. */
export interface RawUnavailableFailure {
  readonly code: 'raw-unavailable'
  readonly captureId: CaptureId
  readonly state: Exclude<CaptureRawState, 'available' | 'corrupt'>
}

/** The stored raw blob failed integrity or decompression checks. */
export interface RawCorruptFailure {
  readonly code: 'raw-corrupt'
  readonly captureId: CaptureId
}

/** Successful Remote result. */
export interface CaptureSuccess<T> {
  readonly ok: true
  readonly value: T
}

/** Expected Remote business failure. */
export interface CaptureRejected<E> {
  readonly ok: false
  readonly error: E
}

/** Descending page of compact captures. */
export interface CaptureListValue {
  readonly captures: readonly CaptureRecord[]
  readonly next?: CaptureCursor
}

/** One compact capture and its derived taxonomy. */
export interface CaptureGetValue {
  readonly capture: CaptureRecord
  readonly taxonomy: ContextTaxonomy | null
}

/** One page of sanitized canonical JSON. */
export interface CaptureRawValue {
  readonly text: string
  readonly offset: number
  readonly nextOffset: number
  readonly done: boolean
  readonly totalChars: number
  readonly logicalRequestHash: string
}

/** Result of `contextTaxonomy.list`. */
export type CaptureListResult = CaptureSuccess<CaptureListValue> | CaptureRejected<SessionNotFoundFailure>

/** Result of `contextTaxonomy.get`. */
export type CaptureGetResult = CaptureSuccess<CaptureGetValue> | CaptureRejected<SessionNotFoundFailure | CaptureNotFoundFailure>

/** Result of `contextTaxonomy.readRaw`. */
export type CaptureRawResult = CaptureSuccess<CaptureRawValue> | CaptureRejected<
  SessionNotFoundFailure | CaptureNotFoundFailure | RawUnavailableFailure | RawCorruptFailure
>
