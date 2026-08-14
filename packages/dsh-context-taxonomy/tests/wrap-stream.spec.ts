import { describe, expect, it, vi } from 'vitest'
import type { StreamChunk } from '@deepseek-ai/dsh-llm/types'
import { observeStream, type StreamObservation } from '../src/capture/wrap-stream.ts'

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const result: StreamChunk[] = []
  for await (const chunk of stream) result.push(chunk)
  return result
}

describe('observeStream', () => {
  it('starts downstream first and preserves every chunk reference and order', async () => {
    const order: string[] = []
    const usage = { type: 'usage', usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 4 } } as const
    const finish = { type: 'finish', reason: { kind: 'stop' } } as const
    async function * source(): AsyncGenerator<StreamChunk> {
      order.push('downstream-next')
      yield usage
      yield finish
    }
    let observation: StreamObservation | undefined
    const output = await collect(observeStream(source(), () => order.push('begin'), value => { observation = value }))

    expect(order).toEqual(['downstream-next', 'begin'])
    expect(output[0]).toBe(usage)
    expect(output[1]).toBe(finish)
    expect(observation).toEqual({ observedOutcome: { kind: 'stop' }, usage: usage.usage })
  })

  it('rethrows downstream errors unchanged and reports them separately', async () => {
    const failure = new Error('middleware exploded')
    let observation: StreamObservation | undefined
    async function * source(): AsyncGenerator<StreamChunk> {
      throw failure
    }
    const promise = collect(observeStream(source(), () => undefined, value => { observation = value }))
    await expect(promise).rejects.toBe(failure)
    expect(observation?.observedOutcome).toMatchObject({
      kind: 'downstream-threw', failure: { code: 'DOWNSTREAM_THROW', message: 'middleware exploded' },
    })
  })

  it('forwards iterator return and distinguishes consumer stop', async () => {
    const returned = vi.fn()
    const source: AsyncIterable<StreamChunk> = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: false, value: { type: 'text-delta', index: 0, text: 'x' } }),
          return: async () => {
            returned()
            return { done: true, value: undefined }
          },
        }
      },
    }
    let observation: StreamObservation | undefined
    for await (const _chunk of observeStream(source, () => undefined, value => { observation = value })) break
    expect(returned).toHaveBeenCalledOnce()
    expect(observation?.observedOutcome).toEqual({ kind: 'consumer-stopped' })
  })

  it('reports a naturally incomplete stream without inventing stop', async () => {
    async function * source(): AsyncGenerator<StreamChunk> {
      yield { type: 'text-delta', index: 0, text: 'partial' }
    }
    let observation: StreamObservation | undefined
    await collect(observeStream(source(), () => undefined, value => { observation = value }))
    expect(observation?.observedOutcome).toEqual({ kind: 'stream-ended-without-finish' })
  })

  it.each([
    [{ kind: 'tool-calls' }, { kind: 'tool-calls' }],
    [{ kind: 'max-tokens' }, { kind: 'max-tokens' }],
    [{ kind: 'error', failure: { code: 'RATE_LIMIT', message: 'later', status: 429 } },
      { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'later', status: 429 } }],
    [{ kind: 'aborted', failure: { code: 'ABORTED', message: 'cancelled' } },
      { kind: 'aborted', failure: { code: 'ABORTED', message: 'cancelled' } }],
  ])('preserves the observed finish meaning for %j', async (reason, expected) => {
    async function * source(): AsyncGenerator<StreamChunk> {
      yield { type: 'finish', reason } as StreamChunk
    }
    let observation: StreamObservation | undefined
    await collect(observeStream(source(), () => undefined, value => { observation = value }))
    expect(observation?.observedOutcome).toEqual(expected)
  })

  it('keeps the final usage chunk without filling missing optional fields', async () => {
    async function * source(): AsyncGenerator<StreamChunk> {
      yield { type: 'usage', usage: { inputTokens: 8, outputTokens: 1, cacheReadTokens: 2 } }
      yield { type: 'usage', usage: { inputTokens: 9, outputTokens: 3 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
    let observation: StreamObservation | undefined
    await collect(observeStream(source(), () => undefined, value => { observation = value }))
    expect(observation?.usage).toEqual({ inputTokens: 9, outputTokens: 3 })
    expect(observation?.usage).not.toHaveProperty('cacheReadTokens')
  })
})
