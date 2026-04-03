import { DelayStrategy } from '../types';

/**
 * Creates an exponential backoff strategy.
 * Formula: delay = base * (factor ^ attempt)
 * 
 * @param baseDelay Starting delay in milliseconds
 * @param factor Exponential factor (default: 2)
 */
export const exponentialStrategy = (baseDelay: number, factor: number = 2): DelayStrategy => {
  return (attempt: number): number => {
    return baseDelay * Math.pow(factor, attempt);
  };
};
