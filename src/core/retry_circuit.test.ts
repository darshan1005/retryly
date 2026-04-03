import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from './retry';
import { CircuitBreaker } from '../circuit/breaker';
import { CircuitOpenError } from '../utils/errors';
import { fixedStrategy } from '../strategies/fixed';

describe('retry with circuit breaker integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should open the circuit after final failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // 1st final failure (after 1 retry = 2 attempts)
    await expect(retry(fn, { 
      retries: 1, 
      strategy: fixedStrategy(0),
      shouldRetry: () => true,
      circuitBreaker: breaker 
    })).rejects.toThrow();
    
    expect(breaker.getState()).toBe('CLOSED');

    // 2nd final failure
    await expect(retry(fn, { 
      retries: 1, 
      strategy: fixedStrategy(0),
      shouldRetry: () => true,
      circuitBreaker: breaker 
    })).rejects.toThrow();

    expect(breaker.getState()).toBe('OPEN');
  });

  it('should block execution when circuit is open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    breaker.onFailure(); // Open it manually
    
    const fn = vi.fn().mockResolvedValue('success');
    
    await expect(retry(fn, { circuitBreaker: breaker }))
      .rejects.toThrow(CircuitOpenError);
    
    expect(fn).not.toHaveBeenCalled();
  });

  it('should recover when circuit transitions to HALF_OPEN and succeeds', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    breaker.onFailure(); // State: OPEN
    
    await vi.advanceTimersByTimeAsync(1001); // State will become HALF_OPEN on next canExecute()
    
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn, { circuitBreaker: breaker });
    
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should NOT trigger circuit failure on individual retry failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('success');

    // Should succeed on 2nd attempt, circuit should stay CLOSED
    const result = await retry(fn, { 
      retries: 1, 
      strategy: fixedStrategy(0),
      shouldRetry: () => true,
      circuitBreaker: breaker 
    });

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
