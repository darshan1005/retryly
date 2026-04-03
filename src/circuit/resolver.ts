import { CircuitBreaker } from './breaker';
import { CircuitBreakerInterface, CircuitBreakerOptions } from './types';
import { RetryOptions } from '../types';

/**
 * Resolves a circuit breaker from the provided options.
 * Returns an existing instance if provided, or creates a new one from config.
 */
export function resolveCircuit(
  options: RetryOptions
): CircuitBreakerInterface | undefined {
  const { circuitBreaker } = options;

  if (!circuitBreaker) {
    return undefined;
  }

  // Check if it's an instance (has the canExecute method)
  if (typeof (circuitBreaker as any).canExecute === 'function') {
    return circuitBreaker as CircuitBreakerInterface;
  }

  // Otherwise, treat as config object
  return new CircuitBreaker(circuitBreaker as CircuitBreakerOptions);
}
