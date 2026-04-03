import { DelayStrategy } from '../types';

/**
 * Creates a fixed delay strategy.
 * Formula: delay = fixed
 * 
 * @param delay Constant delay in milliseconds
 */
export const fixedStrategy = (delay: number): DelayStrategy => {
  return (): number => {
    return delay;
  };
};
