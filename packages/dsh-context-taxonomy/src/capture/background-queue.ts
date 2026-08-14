/** Bounded, failure-contained concurrent work set outside the model stream. */

/** Minimal bounded background task queue. */
export class BackgroundQueue {
  private readonly running = new Set<Promise<void>>()
  private accepting = true
  private readonly drainedWaiters = new Set<() => void>()

  /** @param maxPending - hard admission cap across queued work. */
  constructor(
    readonly maxPending: number,
    private readonly onFailure: (error: unknown) => void,
  ) {}

  /**
   * Admit one task without awaiting it.
   * @param task - contained async work.
   * @returns whether the task entered the queue.
   */
  add(task: () => Promise<void>): boolean {
    if (!this.accepting || this.running.size >= this.maxPending) return false
    const job = Promise.resolve().then(task).catch(this.onFailure)
    this.running.add(job)
    void job.finally(() => {
      this.running.delete(job)
      this.resolveDrained()
    })
    return true
  }

  /** Stop admission and wait for already admitted work. */
  async close(): Promise<void> {
    this.accepting = false
    if (this.running.size === 0) return
    await new Promise<void>(resolve => this.drainedWaiters.add(resolve))
  }

  private resolveDrained(): void {
    if (this.accepting || this.running.size !== 0) return
    for (const resolve of this.drainedWaiters) resolve()
    this.drainedWaiters.clear()
  }
}
