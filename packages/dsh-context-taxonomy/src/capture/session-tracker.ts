/** O(1) open-turn/open-step and retry tracking from the Session event stream. */
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { DshRetryEvidence, LogicalCallLocation } from '../types.ts'

interface TrackerState {
  createdAt: number
  cwd?: string
  turn: number | undefined
  step: number | undefined
  stepStartSeq: number | undefined
  callOrdinal: number
  retry: DshRetryEvidence | undefined
}

/** Location allocated when an ordinary logical call reaches the listener. */
export interface TrackedCall {
  readonly location: LogicalCallLocation
  readonly dshRetry?: DshRetryEvidence
}

/** Incremental tracker that never scans a live Session on the capture hot path. */
export class SessionTracker {
  private readonly sessions = new Map<SessionId, TrackerState>()

  /**
   * Adopt a live Session, folding its current log once for hot reload safety.
   * @param session - live Session to adopt.
   */
  adopt(session: Session): void {
    const state: TrackerState = {
      createdAt: session.header.createdAt,
      ...(session.header.cwd === undefined ? {} : { cwd: session.header.cwd }),
      turn: undefined,
      step: undefined,
      stepStartSeq: undefined,
      callOrdinal: 0,
      retry: undefined,
    }
    this.sessions.set(session.id, state)
    for (const event of session.events) this.applyEvent(state, event)
  }

  /**
   * Increment one live Session with a newly published event.
   * @param session - event owner.
   * @param event - committed event.
   */
  observe(session: Session, event: SessionEvent): void {
    let state = this.sessions.get(session.id)
    if (state === undefined || state.createdAt !== session.header.createdAt || state.cwd !== session.header.cwd) {
      this.adopt(session)
      return
    }
    this.applyEvent(state, event)
  }

  /** Remove one exact live lifecycle. */
  retire(session: Session): void {
    const state = this.sessions.get(session.id)
    if (state?.createdAt === session.header.createdAt && state.cwd === session.header.cwd) {
      this.sessions.delete(session.id)
    }
  }

  /**
   * Allocate a plugin-local ordinal for one reached logical call.
   * @param session - exact live Session resolved from request routing.
   * @returns current open location or undefined outside an open step.
   */
  allocate(session: Session): TrackedCall | undefined {
    const state = this.sessions.get(session.id)
    if (state === undefined || state.createdAt !== session.header.createdAt || state.cwd !== session.header.cwd
      || state.turn === undefined || state.step === undefined || state.stepStartSeq === undefined) return
    const location: LogicalCallLocation = Object.freeze({
      turn: state.turn,
      step: state.step,
      callOrdinal: state.callOrdinal++,
      stepStartSeq: state.stepStartSeq,
    })
    const retry = state.retry
    state.retry = undefined
    return Object.freeze({ location, ...(retry === undefined ? {} : { dshRetry: retry }) })
  }

  private applyEvent(state: TrackerState, event: SessionEvent): void {
    switch (event.type) {
      case 'turn/start':
        state.turn = event.data.turn
        state.step = undefined
        state.stepStartSeq = undefined
        state.callOrdinal = 0
        state.retry = undefined
        break
      case 'step/start':
        state.turn = event.data.turn
        state.step = event.data.step
        state.stepStartSeq = event.seq
        state.callOrdinal = 0
        state.retry = undefined
        break
      case 'step/end':
        state.step = undefined
        state.stepStartSeq = undefined
        state.callOrdinal = 0
        state.retry = undefined
        break
      case 'turn/end':
        state.turn = undefined
        state.step = undefined
        state.stepStartSeq = undefined
        state.callOrdinal = 0
        state.retry = undefined
        break
      case 'llm/retry-started':
        state.retry = Object.freeze({ retryId: event.data.retryId, retry: event.data.retry })
        break
      default:
        break
    }
  }
}
