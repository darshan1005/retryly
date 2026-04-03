import { CircuitBreakerInterface, CircuitBreakerOptions, CircuitState } from './types';

export class CircuitBreaker implements CircuitBreakerInterface {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private nextAttempt: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.successThreshold = options.successThreshold ?? 1;
    this.resetTimeout = options.resetTimeout;
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    return true;
  }

  onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  onFailure(): void {
    this.failures++;

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED';
  }

  getState(): CircuitState {
    return this.state;
  }
}
