import { RetryBudget } from './retryBudget';
import { RetryBudgetInterface, RetryBudgetOptions } from './types';
import { RetryOptions } from '../types';

/**
 * Resolves a retry budget from the provided options.
 * Returns an existing instance if provided, or creates a new one from config.
 */
export function resolveRetryBudget(
  options: RetryOptions
): RetryBudgetInterface | undefined {
  const { retryBudget } = options;

  if (!retryBudget) {
    return undefined;
  }

  // Check if it's an instance (has the canRetry method)
  if (typeof (retryBudget as any).canRetry === 'function') {
    return retryBudget as RetryBudgetInterface;
  }

  // Otherwise, treat as config object
  return new RetryBudget(retryBudget as RetryBudgetOptions);
}
