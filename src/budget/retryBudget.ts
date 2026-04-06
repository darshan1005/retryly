import { RetryBudgetInterface, RetryBudgetOptions } from './types';

export class RetryBudget implements RetryBudgetInterface {
  private retryCount: number = 0;
  private resetTime: number = 0;

  private readonly maxRetries: number;
  private readonly window: number;
  private readonly options: RetryBudgetOptions;

  constructor(options: RetryBudgetOptions) {
    this.maxRetries = options.maxRetries;
    this.window = options.window;
    this.options = options;
    this.updateResetTime();
  }

  consume(): boolean {
    const now = Date.now();

    if (now > this.resetTime) {
      this.reset();
    }

    if (this.retryCount >= this.maxRetries) {
      if (this.retryCount === this.maxRetries) {
        // Trigger exhausted callback exactly once per window when limit hit
        this.options.onExhausted?.();
      }
      return false;
    }

    this.retryCount++;
    return true;
  }

  getStats() {
    const now = Date.now();
    if (now > this.resetTime) {
      return { remaining: this.maxRetries, resetIn: 0, used: 0 };
    }
    return {
      remaining: Math.max(0, this.maxRetries - this.retryCount),
      resetIn: this.resetTime - now,
      used: this.retryCount
    };
  }

  canRetry(): boolean {
    const now = Date.now();
    if (now > this.resetTime) this.reset();
    return this.retryCount < this.maxRetries;
  }

  recordRetry(): void {
    this.retryCount++;
  }

  reset(): void {
    this.retryCount = 0;
    this.updateResetTime();
  }

  private updateResetTime(): void {
    this.resetTime = Date.now() + this.window;
  }
}
