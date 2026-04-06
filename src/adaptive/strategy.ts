/**
 * Adaptive delay strategy that adjusts backoff based on error type.
 * 
 * @param error Current error
 * @param attempt Current attempt count
 * @returns Delay in milliseconds
 */
export function adaptiveDelay(error: any, attempt: number): number {
  // 1. Rate Limiting (Too Many Requests) -> Use slow exponential backoff
  if (error?.status === 429 || error?.response?.status === 429) {
    const retryAfter =
      error?.response?.headers?.['retry-after'] ||
      error?.headers?.['retry-after'];

    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (!isNaN(parsed)) return parsed * 1000; // seconds -> ms
      const date = new Date(retryAfter).getTime();
      if (!isNaN(date)) return Math.max(0, date - Date.now());
    }

    return 1000 * Math.pow(3, attempt);
  }

  // 2. Network/Connectivity Errors -> Use fast incremental backoff
  const networkErrorCodes = [
    'ECONNRESET', 
    'ETIMEDOUT', 
    'EPIPE', 
    'ENOTFOUND', 
    'ECONNREFUSED', 
    'EAI_AGAIN'
  ];
  
  const isNetworkError = 
    networkErrorCodes.includes(error?.code) || 
    error?.name === 'NetworkError' ||
    error?.message?.toLowerCase().includes('network') ||
    error?.message?.toLowerCase().includes('connectivity');

  if (isNetworkError) {
    // Fast retry for transient network blips: 100ms, 200ms, 300ms...
    return 100 * (attempt + 1);
  }

  // 3. Other errors (e.g. 503 Service Unavailable) -> Use standard exponential backoff
  return 1000 * Math.pow(2, attempt);
}
