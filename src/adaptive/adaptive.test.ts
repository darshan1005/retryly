import { describe, it, expect } from 'vitest';
import { adaptiveDelay } from './strategy';

describe('adaptiveDelay', () => {
  it('should use slow exponential backoff for 429 errors', () => {
    const error = { status: 429 };
    
    // 1000 * 3^0 = 1000
    expect(adaptiveDelay(error, 0)).toBe(1000);
    // 1000 * 3^1 = 3000
    expect(adaptiveDelay(error, 1)).toBe(3000);
    // 1000 * 3^2 = 9000
    expect(adaptiveDelay(error, 2)).toBe(9000);
  });

  it('should use fast incremental backoff for network errors', () => {
    const error = { code: 'ECONNRESET' };
    
    // 100 * (0 + 1) = 100
    expect(adaptiveDelay(error, 0)).toBe(100);
    // 100 * (1 + 1) = 200
    expect(adaptiveDelay(error, 1)).toBe(200);
    // 100 * (2 + 1) = 300
    expect(adaptiveDelay(error, 2)).toBe(300);
  });

  it('should fall back to standard exponential backoff for other errors', () => {
    const error = new Error('generic failure');
    
    // 1000 * 2^0 = 1000
    expect(adaptiveDelay(error, 0)).toBe(1000);
    // 1000 * 2^1 = 2000
    expect(adaptiveDelay(error, 1)).toBe(2000);
    // 1000 * 2^2 = 4000
    expect(adaptiveDelay(error, 2)).toBe(4000);
  });
});
