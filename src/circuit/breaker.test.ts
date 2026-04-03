import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from './breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should start in CLOSED state', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should open after failureThreshold is reached', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    
    breaker.onFailure();
    expect(breaker.getState()).toBe('CLOSED');
    
    breaker.onFailure();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should transition to HALF_OPEN after resetTimeout', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    
    breaker.onFailure();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
    
    // Advance time by 1001ms
    vi.advanceTimersByTime(1001);
    
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('should close after successThreshold is reached in HALF_OPEN', () => {
    const breaker = new CircuitBreaker({ 
      failureThreshold: 1, 
      resetTimeout: 1000,
      successThreshold: 2 
    });
    
    breaker.onFailure();
    vi.advanceTimersByTime(1001);
    
    // Lazy transition: must call canExecute() to move to HALF_OPEN
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe('HALF_OPEN');
    
    breaker.onSuccess();
    expect(breaker.getState()).toBe('HALF_OPEN');
    
    breaker.onSuccess();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should reopen if failure occurs in HALF_OPEN', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });
    
    breaker.onFailure();
    vi.advanceTimersByTime(1001);
    
    // Lazy transition
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe('HALF_OPEN');
    
    breaker.onFailure();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should reset failure count on success in CLOSED state', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });
    
    breaker.onFailure();
    breaker.onSuccess();
    breaker.onFailure();
    
    // Should still be closed because successes reset the failure counter in CLOSED state
    expect(breaker.getState()).toBe('CLOSED');
  });
});
