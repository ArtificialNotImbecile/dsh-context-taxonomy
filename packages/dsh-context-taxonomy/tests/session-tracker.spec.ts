import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { SessionTracker } from '../src/capture/session-tracker.ts'

const SESSION_ID = '019d0e3a-55ff-7000-8000-000000000001' as SessionId

function event(type: string, seq: number, data: Record<string, unknown>): SessionEvent {
  return { type, seq, data } as unknown as SessionEvent
}

function session(events: readonly SessionEvent[]): Session {
  return {
    id: SESSION_ID,
    header: { id: SESSION_ID, createdAt: 1_700_000_000_000, cwd: '/workspace' },
    events,
  } as unknown as Session
}

describe('SessionTracker', () => {
  it('allocates monotonically within an adopted open step', () => {
    const tracker = new SessionTracker()
    const live = session([
      event('turn/start', 1, { turn: 3 }),
      event('step/start', 2, { turn: 3, step: 2 }),
    ])
    tracker.adopt(live)

    expect(tracker.allocate(live)?.location).toEqual({ turn: 3, step: 2, callOrdinal: 0, stepStartSeq: 2 })
    expect(tracker.allocate(live)?.location.callOrdinal).toBe(1)
  })

  it('attaches official retry-started evidence to exactly the next logical call', () => {
    const tracker = new SessionTracker()
    const live = session([
      event('turn/start', 1, { turn: 1 }),
      event('step/start', 2, { turn: 1, step: 1 }),
    ])
    tracker.adopt(live)
    expect(tracker.allocate(live)?.dshRetry).toBeUndefined()

    tracker.observe(live, event('llm/retry-started', 3, { retryId: 'retry-chain', retry: 1 }))

    expect(tracker.allocate(live)?.dshRetry).toEqual({ retryId: 'retry-chain', retry: 1 })
    expect(tracker.allocate(live)?.dshRetry).toBeUndefined()
  })

  it('refuses allocation outside an open step and resets ordinals for the next step', () => {
    const tracker = new SessionTracker()
    const live = session([
      event('turn/start', 1, { turn: 1 }),
      event('step/start', 2, { turn: 1, step: 1 }),
    ])
    tracker.adopt(live)
    expect(tracker.allocate(live)?.location.callOrdinal).toBe(0)

    tracker.observe(live, event('step/end', 3, { turn: 1, step: 1 }))
    expect(tracker.allocate(live)).toBeUndefined()
    tracker.observe(live, event('step/start', 4, { turn: 1, step: 2 }))

    expect(tracker.allocate(live)?.location).toEqual({ turn: 1, step: 2, callOrdinal: 0, stepStartSeq: 4 })
  })
})
