/**
 * Error thrown when an operation is cancelled via AbortSignal.
 */
export class AbortError extends Error {
  constructor(message: string = 'The operation was aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Checks if a signal is aborted and throws an AbortError if so.
 */
export const checkSignal = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new AbortError(signal.reason);
  }
};

/**
 * Error thrown when an operation fails after all retries are exhausted.
 */
export class RetryError extends Error {
  constructor(
    public readonly message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Error thrown when the circuit breaker is open and blocks execution.
 */
export class CircuitOpenError extends Error {
  constructor(message: string = 'Circuit is open. Request blocked.') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
