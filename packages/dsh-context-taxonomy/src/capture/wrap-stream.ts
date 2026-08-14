/** Transparent chunk-stream observation with exact iterator cleanup forwarding. */
import type { FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm/types'
import type { CaptureFailure, ObservedOutcome } from '../types.ts'

/** Outcome metadata delivered asynchronously to sidecar persistence. */
export interface StreamObservation {
  readonly observedOutcome: ObservedOutcome
  readonly usage?: TokenUsage
}

function errorFailure(error: unknown): CaptureFailure {
  if (error instanceof Error) {
    return Object.freeze({
      code: 'DOWNSTREAM_THROW',
      message: error.message,
      ...('status' in error && typeof error.status === 'number' ? { status: error.status } : {}),
    })
  }
  return Object.freeze({ code: 'DOWNSTREAM_THROW', message: String(error) })
}

function finishOutcome(reason: FinishReason): ObservedOutcome {
  switch (reason.kind) {
    case 'stop': return Object.freeze({ kind: 'stop' })
    case 'tool-calls': return Object.freeze({ kind: 'tool-calls' })
    case 'max-tokens': return Object.freeze({ kind: 'max-tokens' })
    case 'aborted': return Object.freeze({ kind: 'aborted', failure: Object.freeze({
      code: reason.failure.code,
      message: reason.failure.message,
      ...(reason.failure.status === undefined ? {} : { status: reason.failure.status }),
    }) })
    case 'error': return Object.freeze({ kind: 'error', failure: Object.freeze({
      code: reason.failure.code,
      message: reason.failure.message,
      ...(reason.failure.status === undefined ? {} : { status: reason.failure.status }),
    }) })
    default: return Object.freeze({
      kind: 'unknown-finish',
      providerKind: String((reason as { readonly kind: unknown }).kind),
    })
  }
}

/**
 * Observe one downstream stream without modifying values, errors, or return cleanup.
 * @param source - downstream waterfall stream.
 * @param settle - non-blocking settlement callback.
 * @returns transparent async iterable.
 */
export async function * observeStream(
  source: AsyncIterable<StreamChunk>,
  begin: () => void,
  settle: (observation: StreamObservation) => void,
): AsyncGenerator<StreamChunk> {
  const iterator = source[Symbol.asyncIterator]()
  let usage: TokenUsage | undefined
  let outcome: ObservedOutcome | undefined
  let exhausted = false
  let thrown = false
  let began = false
  try {
    while (true) {
      const pending = iterator.next()
      if (!began) {
        began = true
        begin()
      }
      const result = await pending
      if (result.done) {
        exhausted = true
        break
      }
      const chunk = result.value
      if (chunk.type === 'usage') usage = chunk.usage
      else if (chunk.type === 'finish') outcome = finishOutcome(chunk.reason)
      yield chunk
    }
  } catch (error: unknown) {
    thrown = true
    outcome = Object.freeze({ kind: 'downstream-threw', failure: errorFailure(error) })
    throw error
  } finally {
    if (!exhausted && !thrown && outcome === undefined) outcome = Object.freeze({ kind: 'consumer-stopped' })
    try {
      if (!exhausted && !thrown && iterator.return !== undefined) await iterator.return()
    } finally {
      if (began) {
        settle(Object.freeze({
          observedOutcome: outcome ?? Object.freeze({ kind: 'stream-ended-without-finish' }),
          ...(usage === undefined ? {} : { usage }),
        }))
      }
    }
  }
}
