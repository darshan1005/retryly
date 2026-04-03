import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryBudget } from './retryBudget';

describe('RetryBudget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow retries under the limit', () => {
    const budget = new RetryBudget({ maxRetries: 2, window: 1000 });
    
    expect(budget.canRetry()).toBe(true);
    budget.recordRetry();
    
    expect(budget.canRetry()).toBe(true);
    budget.recordRetry();
    
    expect(budget.canRetry()).toBe(false);
  });

  it('should reset the budget after the window duration', () => {
    const budget = new RetryBudget({ maxRetries: 1, window: 1000 });
    
    budget.recordRetry();
    expect(budget.canRetry()).toBe(false);
    
    // Advance time by 1001ms
    vi.advanceTimersByTime(1001);
    
    expect(budget.canRetry()).toBe(true);
  });

  it('should support manual reset', () => {
    const budget = new RetryBudget({ maxRetries: 1, window: 1000 });
    
    budget.recordRetry();
    expect(budget.canRetry()).toBe(false);
    
    budget.reset();
    expect(budget.canRetry()).toBe(true);
  });
});
