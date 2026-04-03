import { describe, it, expect } from 'vitest';
import { resolvePriority } from './resolver';

describe('resolvePriority', () => {
  it('should increase retries and decrease delays for high priority', () => {
    const strategy = (n: number) => 1000;
    const options = { priority: 'high' as const, retries: 2, strategy };
    
    const result = resolvePriority(options);
    
    expect(result.retries).toBe(4);
    expect(result.strategy!(0)).toBe(500);
  });

  it('should decrease retries and increase delays for low priority', () => {
    const strategy = (n: number) => 1000;
    const options = { priority: 'low' as const, retries: 2, strategy };
    
    const result = resolvePriority(options);
    
    expect(result.retries).toBe(1);
    expect(result.strategy!(0)).toBe(1500);
  });

  it('should not change options for normal priority', () => {
    const options = { priority: 'normal' as const, retries: 2 };
    const result = resolvePriority(options);
    expect(result).toBe(options);
  });
});
