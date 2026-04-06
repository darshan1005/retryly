import { DelayStrategy } from '../types';

/**
 * Creates a linear backoff strategy.
 * Formula: delay = base + (increment * attempt)
 * 
 * @param baseDelay Starting delay in milliseconds
 * @param increment Amount to add per attempt
 */
export const linearStrategy = (baseDelay: number, increment: number, maxDelay: number = 30000): DelayStrategy => {
  return (attempt: number): number => {
    return Math.min(baseDelay + (increment * attempt), maxDelay);
  };
};
