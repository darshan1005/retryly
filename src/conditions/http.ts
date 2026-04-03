import { RetryCondition } from '../types';

/**
 * Checks if an error is a retryable HTTP error (5xx).
 * Skips client errors (4xx).
 */
export const httpCondition: RetryCondition = (error: any): boolean => {
  // Support for common fetch/axios error patterns
  const status = error?.status || error?.response?.status || error?.statusCode;
  
  if (status) {
    return status >= 500 && status <= 599;
  }

  return false;
};
