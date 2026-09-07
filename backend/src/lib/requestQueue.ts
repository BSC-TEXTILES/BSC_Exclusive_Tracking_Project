interface QueueItem {
  id: string
  timestamp: number
  priority: number
  resolve: () => void
  reject: (err: Error) => void
}

interface QueueOptions {
  maxConcurrent: number
  maxQueue: number
  timeoutMs: number
}

export class RequestQueue {
  private running = 0
  private queue: QueueItem[] = []
  private readonly opts: QueueOptions
  private counter = 0

  constructor(opts: QueueOptions) {
    this.opts = opts
  }

  async acquire(priority = 0): Promise<void> {
    if (this.running < this.opts.maxConcurrent) {
      this.running++
      return
    }

    if (this.queue.length >= this.opts.maxQueue) {
      throw new Error('SERVER_OVERLOADED')
    }

    return new Promise<void>((resolve, reject) => {
      const id = `req_${++this.counter}_${Date.now()}`
      const item: QueueItem = { id, timestamp: Date.now(), priority, resolve, reject }

      const idx = this.queue.findIndex((q) => q.priority < priority)
      if (idx === -1) {
        this.queue.push(item)
      } else {
        this.queue.splice(idx, 0, item)
      }

      setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.id === id)
        if (idx !== -1) {
          this.queue.splice(idx, 1)
          reject(new Error('QUEUE_TIMEOUT'))
        }
      }, this.opts.timeoutMs)
    })
  }

  release() {
    this.running--
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      this.running++
      next.resolve()
    }
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.opts.maxConcurrent,
      maxQueue: this.opts.maxQueue,
    }
  }
}

export const apiQueue = new RequestQueue({
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '0', 10) || 1000,
  maxQueue: parseInt(process.env.MAX_QUEUE || '0', 10) || 5000,
  timeoutMs: 30_000,
})
