import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from './retry';

describe('V4 Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should combine retry and hedging', async () => {
    const fn = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 100)))
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve('success'), 10)));

    const promise = retry(fn, {
      retries: 1,
      hedging: { enabled: true, delay: 50, maxHedges: 1 },
      // To ensure and check timing
      strategy: () => 0
    });

    // Primary (attempt 0) fails slowly at 100ms.
    // Hedge launches at 50ms.
    // Hedge finishes at 60ms (50 + 10).
    
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(10);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should respect priority in integrated environment', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const onRetry = vi.fn();

    // High priority should use 50% delay
    // Assuming attempt 0 fails...
    fn.mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const promise = retry(fn, {
      priority: 'high',
      retries: 1,
      strategy: () => 1000,
      shouldRetry: () => true,
      onRetry
    });

    // We must advance timers to allow the retry to proceed
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe('ok');

    // onRetry is called with delayMs which should be 500
    expect(onRetry).toHaveBeenCalledWith(expect.anything(), 0, 500);
  });
});
