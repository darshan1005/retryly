import { RetryOptions } from '../types';
import { resolvePolicy } from '../policies';

/**
 * Resolves priority settings and applies them to RetryOptions.
 * Should be called before policy resolution.
 * 
 * HIGH: +2 retries, 50% faster delays
 * LOW: -1 retries (min 0), 50% slower delays
 */
export function resolvePriority(options: RetryOptions): RetryOptions {
  const { priority } = options;
  if (!priority || priority === 'normal') {
    return options;
  }

  const result = { ...options };

  if (priority === 'high') {
    // Increase retries if they exist, or set a floor if they don't?
    // According to the merge rule, we only adjust if present, 
    // or we can provide a default base.
    if (result.retries === undefined) {
      result.retries = resolvePolicy(options).retries;
    }
    result.retries += 2;
    
    // If a strategy exists, wrap it to be faster
    if (result.strategy) {
      const original = result.strategy;
      result.strategy = (attempt: number) => Math.floor(original(attempt) * 0.5);
    }
  } else if (priority === 'low') {
    if (result.retries === undefined) {
      result.retries = resolvePolicy(options).retries;
    }
    result.retries = Math.max(0, result.retries - 1);

    if (result.strategy) {
      const original = result.strategy;
      result.strategy = (attempt: number) => Math.floor(original(attempt) * 1.5);
    }
  }

  return result;
}
