import { describe, expect, it, vi } from 'vitest'
import { BackgroundQueue } from '../src/capture/background-queue.ts'

describe('BackgroundQueue', () => {
  it('bounds admitted work and drains admitted tasks after close', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const queue = new BackgroundQueue(1, () => undefined)

    expect(queue.add(async () => gate)).toBe(true)
    expect(queue.add(async () => undefined)).toBe(false)
    const closing = queue.close()
    release()
    await closing
    expect(queue.add(async () => undefined)).toBe(false)
  })

  it('contains task failures without rejecting close', async () => {
    const failure = new Error('storage failed')
    const onFailure = vi.fn()
    const queue = new BackgroundQueue(1, onFailure)

    expect(queue.add(async () => { throw failure })).toBe(true)
    await expect(queue.close()).resolves.toBeUndefined()
    expect(onFailure).toHaveBeenCalledWith(failure)
  })
})
