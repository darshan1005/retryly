import { RetryOptions, FailureContext } from '../types';
import { resolvePolicy } from '../policies';
import { delay } from '../utils/delay';
import { checkSignal, AbortError, RetryError, CircuitOpenError } from '../utils/errors';
import { resolveCircuit } from '../circuit/resolver';
import { resolveRetryBudget } from '../budget/resolver';
import { adaptiveDelay } from '../adaptive/strategy';
import { executeWithHedging } from '../hedging/executor';
import { resolvePriority } from '../priority/resolver';

/**
 * Executes an asynchronous function with retry logic based on the provided options.
 * 
 * @param fn Operation to retry
 * @param options Retry options and policy configuration
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const prioritizedOptions = resolvePriority(options);
  const policy = resolvePolicy(prioritizedOptions);
  const circuit = resolveCircuit(prioritizedOptions);
  const budget = resolveRetryBudget(prioritizedOptions);
  const { onRetry, onSuccess, onFailure, signal } = prioritizedOptions;
  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    try {
      // Check if this is a retry (not the first attempt) and if budget is exhausted
      if (attempt > 0 && budget && !budget.canRetry()) {
        // We handle this inside the catch block for cleaner final failure reporting
        throw new Error('Retry budget exhausted');
      }

      // Check circuit breaker before each attempt
      if (circuit && !circuit.canExecute()) {
        throw new CircuitOpenError();
      }

      // Check if aborted before starting an attempt
      checkSignal(signal);

      // Execute the operation (with hedging if enabled)
      // Safety: We pass the circuit and budget so hedging can respect their states
      const result = await executeWithHedging(fn, prioritizedOptions, circuit, budget);

      // Trigger circuit breaker success
      if (circuit) {
        circuit.onSuccess();
      }

      // Trigger success hook if provided
      if (onSuccess) {
        await onSuccess({ attempt, result });
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Map DOMException/AbortError to our custom AbortError if needed
      if (error?.name === 'AbortError' || error instanceof AbortError) {
        if (onFailure) {
          await onFailure({ attempt, error });
        }
        throw error;
      }

      // If it's a CircuitOpenError or Budget Exhausted, just throw it 
      // (without contributing to circuit failure or hooks in case of budget)
      if (error instanceof CircuitOpenError || error.message === 'Retry budget exhausted') {
        throw error;
      }

      // Check if we should stop: 
      // 1. All retries exhausted
      // 2. Policy says "don't retry" based on the error
      const isLastAttempt = attempt === policy.retries;
      const shouldRetry = policy.shouldRetry(error, attempt);

      if (isLastAttempt || !shouldRetry) {
        // Trigger circuit breaker failure on FINAL failure
        if (circuit) {
          circuit.onFailure();
        }

        // Trigger failure hook if provided before throwing
        if (onFailure) {
          await onFailure({ attempt, error });
        }
        
        if (isLastAttempt) {
          throw new RetryError(
            `Operation failed after ${attempt} retries: ${error.message || 'Unknown error'}`,
            attempt,
            error
          );
        }

        throw error;
      }

      // Record retry in budget before waiting
      if (budget) {
        budget.recordRetry();
      }

      // Calculate wait time: adaptive or policy strategy
      const delayMs = prioritizedOptions.adaptive 
        ? adaptiveDelay(error, attempt) 
        : policy.strategy(attempt);

      // Trigger retry hook if provided
      if (onRetry) {
        await onRetry(error, attempt, delayMs);
      }

      // Wait before next attempt, supporting cancellation
      await delay(delayMs, signal);
    }
  }

  // This line should technically never be reached due to the rethrow in the catch block
  throw lastError;
}
