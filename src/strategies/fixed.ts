import { DelayStrategy } from '../types';

/**
 * Creates a fixed delay strategy.
 * Formula: delay = fixed
 * 
 * @param delay Constant delay in milliseconds
 */
export const fixedStrategy = (delay: number, maxDelay: number = 30000): DelayStrategy => {
  return (): number => {
    return Math.min(delay, maxDelay);
  };
};
