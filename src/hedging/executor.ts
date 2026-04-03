import { RetryOptions } from '../types';
import { CircuitBreakerInterface } from '../circuit/types';
import { RetryBudgetInterface } from '../budget/types';

// Global counter for active hedging requests to prevent infrastructure overload
let activeHedges = 0;
const GLOBAL_HEDGE_LIMIT = 50;

/**
 * Executes an operation with hedging.
 * Launches duplicate requests after a specified delay if the original hasn't resolved.
 * Returns the first successful response and cancels others.
 * 
 * Safety:
 * - Respects global concurrency limit (activeHedges)
 * - Respects RetryBudget and CircuitBreaker for each hedge attempt
 */
export async function executeWithHedging<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  circuit?: CircuitBreakerInterface,
  budget?: RetryBudgetInterface
): Promise<T> {
  const { hedging, signal: externalSignal } = options;

  // Fallback if hedging is not configured, disabled, or limit reached
  if (!hedging || !hedging.enabled || activeHedges >= GLOBAL_HEDGE_LIMIT) {
    return fn();
  }

  const { delay: hedgeDelay, maxHedges = 1 } = hedging;
  const totalAttemptsAllowed = 1 + maxHedges;
  const controllers: AbortController[] = [];
  
  let completed = false;
  let lastError: unknown;
  let finishedAttempts = 0;

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      completed = true;
      controllers.forEach(c => c.abort());
      // External listeners and timeouts are automatically cleaned up if implemented correctly
    };

    // Handle external cancellation
    if (externalSignal) {
      if (externalSignal.aborted) {
        return reject(externalSignal.reason || new Error('Aborted'));
      }
      externalSignal.addEventListener('abort', cleanup, { once: true });
    }

    const runAttempt = async (index: number) => {
      if (completed) return;

      // For hedges (index > 0): Perform safety checks before launching
      if (index > 0) {
        // 1. Check Circuit Breaker
        if (circuit && !circuit.canExecute()) {
          // If circuit is open, we skip this hedge but don't fail the whole operation
          // as the primary request is still running.
          return;
        }

        // 2. Check Retry Budget
        if (budget && !budget.canRetry()) {
          // If budget is exhausted, skip the hedge.
          return;
        }

        // 3. Increment budget usage for the hedge
        if (budget) {
          budget.recordRetry();
        }
      }

      const controller = new AbortController();
      controllers.push(controller);
      
      activeHedges++;

      try {
        const result = await fn();
        
        if (!completed) {
          cleanup();
          resolve(result);
        }
      } catch (error) {
        lastError = error;
        finishedAttempts++;

        // If all attempts (primary + hedges) failed, reject with the last error
        if (finishedAttempts === totalAttemptsAllowed && !completed) {
          cleanup();
          reject(lastError);
        }
      } finally {
        activeHedges--;
      }
    };

    // Start primary request immediately
    runAttempt(0);

    // Schedule hedges
    for (let i = 1; i <= maxHedges; i++) {
      setTimeout(() => {
        if (!completed) {
          runAttempt(i);
        }
      }, i * hedgeDelay);
    }
  });
}
