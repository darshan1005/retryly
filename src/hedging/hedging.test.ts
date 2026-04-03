import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWithHedging } from './executor';

describe('executeWithHedging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the fastest response', async () => {
    const fn = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve('first'), 500)))
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve('second'), 100)));

    const promise = executeWithHedging(fn, {
      hedging: { enabled: true, delay: 100, maxHedges: 1 }
    });

    // Advance to 100ms: second request is launched
    await vi.advanceTimersByTimeAsync(100);
    // Advance to 200ms: second request finishes (100ms from its start at 100ms)
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should respect maxHedges', async () => {
    const fn = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves
    
    executeWithHedging(fn, {
      hedging: { enabled: true, delay: 100, maxHedges: 2 }
    });

    await vi.advanceTimersByTimeAsync(500);
    
    // Primary (0ms) + Hedge 1 (100ms) + Hedge 2 (200ms) = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should handle all failures correctly', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const promise = executeWithHedging(fn, {
      hedging: { enabled: true, delay: 10, maxHedges: 1 }
    });

    // Make sure we wait for all internal timers to trigger failure cleanup
    await vi.advanceTimersByTimeAsync(20);
    
    await expect(promise).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
