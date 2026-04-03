import { RetryCondition } from '../types';

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN'
]);

/**
 * Checks if an error is a retryable network error.
 * Retries on: ECONNRESET, ETIMEDOUT, ENOTFOUND, etc.
 */
export const networkCondition: RetryCondition = (error: any): boolean => {
  const errorCode = error?.code || error?.errno;
  
  if (errorCode && typeof errorCode === 'string') {
    return RETRYABLE_NETWORK_CODES.has(errorCode);
  }

  // Handle generic "Network Error" strings
  if (error?.message === 'Network Error' || error?.message?.includes('network error')) {
    return true;
  }

  return false;
};
