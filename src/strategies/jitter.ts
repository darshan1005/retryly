import { DelayStrategy } from '../types';

/**
 * Wraps another strategy with jitter (randomness).
 * Formula: delay = baseDelay * (1 + jitterFactor * random)
 * 
 * @param strategy Original strategy to wrap
 * @param jitterFactor Randomness factor (0 to 1, default: 0.1)
 */
export const withJitter = (strategy: DelayStrategy, jitterFactor: number = 0.1, maxDelay: number = 30000): DelayStrategy => {
  return (attempt: number): number => {
    const delay = strategy(attempt);
    const random = Math.random();
    return Math.min(Math.floor(delay + (delay * jitterFactor * random)), maxDelay);
  };
};
