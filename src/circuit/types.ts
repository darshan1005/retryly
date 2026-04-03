export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successes in HALF_OPEN to close the circuit (default: 1) */
  successThreshold?: number;
  /** Time in milliseconds before moving from OPEN to HALF_OPEN */
  resetTimeout: number;
}

export interface CircuitBreakerInterface {
  /** Returns true if the circuit allows execution */
  canExecute(): boolean;
  /** Should be called on a successful operation */
  onSuccess(): void;
  /** Should be called on a failed operation */
  onFailure(): void;
  /** Returns the current state of the circuit */
  getState(): CircuitState;
}
