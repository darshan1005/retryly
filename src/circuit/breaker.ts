import { CircuitBreakerInterface, CircuitBreakerOptions, CircuitState } from './types';

export class CircuitBreaker implements CircuitBreakerInterface {
  private state: CircuitState = 'CLOSED';
  private failureTimestamps: number[] = [];
  private successes: number = 0;
  private nextAttempt: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;
  private readonly window: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.successThreshold = options.successThreshold ?? 1;
    this.resetTimeout = options.resetTimeout;
    this.window = options.window ?? options.resetTimeout;
    this.onStateChange = options.onStateChange;
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now > this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
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
      this.failureTimestamps = [];
    }
  }

  onFailure(): void {
    const now = Date.now();
    
    // Remove expired failures
    this.failureTimestamps = this.failureTimestamps.filter(
      t => now - t < this.window
    );
    this.failureTimestamps.push(now);

    if (this.failureTimestamps.length >= this.failureThreshold) {
      if (this.state !== 'OPEN') {
        this.transitionTo('OPEN');
        this.nextAttempt = now + this.resetTimeout;
      }
    }
  }

  reset(): void {
    this.failureTimestamps = [];
    this.successes = 0;
    this.transitionTo('CLOSED');
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(oldState, newState);
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
