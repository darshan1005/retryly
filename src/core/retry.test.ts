import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry } from './retry';
import { AbortError, RetryError } from '../utils/errors';
import { fixedStrategy } from '../strategies/fixed';

describe('retry engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should succeed on the first attempt without retry', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and then succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      retries: 3,
      strategy: fixedStrategy(100),
      shouldRetry: () => true // Force retry for generic errors
    });

    // Need to advance timers for each retry
    await vi.advanceTimersByTimeAsync(100); // After 1st fail
    await vi.advanceTimersByTimeAsync(100); // After 2nd fail
    
    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryError after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = retry(fn, {
      retries: 2,
      strategy: fixedStrategy(100),
      shouldRetry: () => true
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toThrow(RetryError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect policy behavior (e.g., retry 5xx but skip 4xx)', async () => {
    // Test skip 4xx
    const error404 = { status: 404, message: 'Not Found' };
    const fn404 = vi.fn().mockRejectedValue(error404);
    await expect(retry(fn404, { policy: 'httpSafe' })).rejects.toEqual(error404);
    expect(fn404).toHaveBeenCalledTimes(1);

    // Test retry 5xx
    const error500 = { status: 500, message: 'Server Error' };
    const fn500 = vi.fn()
      .mockRejectedValueOnce(error500)
      .mockResolvedValue('recovered');
    
    const p500 = retry(fn500, { policy: 'httpSafe', strategy: fixedStrategy(100) });
    await vi.advanceTimersByTimeAsync(1000); // httpSafe uses exponential(1000) by default, but we overrode it or used default
    // Note: resolvePolicy merges strategies. 
    expect(await p500).toBe('recovered');
    expect(fn500).toHaveBeenCalledTimes(2);
  });

  it('should handle AbortSignal cancellation', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const controller = new AbortController();

    const promise = retry(fn, {
      retries: 5,
      strategy: fixedStrategy(1000),
      shouldRetry: () => true, // Ensure it tries to retry
      signal: controller.signal
    });

    // Wait for first failure to happen and enter delay
    await vi.advanceTimersByTimeAsync(0); 
    
    // Abort during delay
    controller.abort();
    
    await expect(promise).rejects.toThrow(AbortError);
  });

  it('should execute lifecycle hooks', async () => {
    const onRetry = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      retries: 1,
      strategy: fixedStrategy(100),
      shouldRetry: () => true,
      onRetry,
      onSuccess,
      onFailure
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('success');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
