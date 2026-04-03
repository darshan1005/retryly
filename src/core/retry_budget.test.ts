import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry } from './retry';
import { RetryBudget } from '../budget/retryBudget';
import { CircuitBreaker } from '../circuit/breaker';
import { fixedStrategy } from '../strategies/fixed';

describe('Retry Budget', () => {
  it('should block retries when budget is exhausted', async () => {
    const budget = new RetryBudget({ maxRetries: 2, window: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // First call: uses 1 retry, exhausts budget because maxRetries: 2
    // (Attempt 0 fails -> recordRetry (1) -> Attempt 1 (Retry 1) fails -> recordRetry (2) -> Attempt 2 (Retry 2) blocked)
    await expect(retry(fn, { 
      retries: 3, 
      strategy: fixedStrategy(0),
      shouldRetry: () => true,
      retryBudget: budget 
    })).rejects.toThrow('Retry budget exhausted');
    
    // Initial + 1 retry = 2 calls
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should work together with circuit breaker', async () => {
    const budget = new RetryBudget({ maxRetries: 10, window: 1000 });
    const circuit = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // 1st final failure
    await expect(retry(fn, { 
      retries: 1, 
      strategy: fixedStrategy(0),
      retryBudget: budget,
      circuitBreaker: circuit
    })).rejects.toThrow();

    // 2nd final failure -> circuit opens
    await expect(retry(fn, { 
      retries: 1, 
      strategy: fixedStrategy(0),
      retryBudget: budget,
      circuitBreaker: circuit
    })).rejects.toThrow();

    expect(circuit.getState()).toBe('OPEN');
  });

  it('should use adaptive strategy when enabled', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    await retry(fn, { 
      retries: 1, 
      adaptive: true,
      shouldRetry: () => true,
      onRetry
    });

    // For 429, adaptiveDelay(0) is 1000ms
    expect(onRetry).toHaveBeenCalledWith(expect.anything(), 0, 1000);
  });
});
