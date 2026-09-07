export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number
  recoveryTimeMs: number
  monitorIntervalMs?: number
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private nextAttempt = 0
  private readonly opts: CircuitBreakerOptions

  constructor(opts: CircuitBreakerOptions) {
    this.opts = opts
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN
        this.successCount = 0
      }
    }
    return this.state
  }

  isOpen(): boolean {
    return this.getState() === CircuitState.OPEN
  }

  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= 2) {
        this.reset()
      }
    } else {
      this.failureCount = 0
    }
  }

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.trip()
    } else if (this.failureCount >= this.opts.failureThreshold) {
      this.trip()
    }
  }

  private trip() {
    this.state = CircuitState.OPEN
    this.nextAttempt = Date.now() + this.opts.recoveryTimeMs
    console.error(`[circuit] Circuit OPENED. Recovery in ${this.opts.recoveryTimeMs / 1000}s`)
  }

  private reset() {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    console.log('[circuit] Circuit CLOSED — service recovered')
  }

  getStats() {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    }
  }
}

export const dbCircuit = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeMs: 30_000,
})

export const externalCircuit = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeMs: 60_000,
})
