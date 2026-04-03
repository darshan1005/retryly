import { RetryBudgetInterface, RetryBudgetOptions } from './types';

export class RetryBudget implements RetryBudgetInterface {
  private retryCount: number = 0;
  private resetTime: number = 0;

  private readonly maxRetries: number;
  private readonly window: number;

  constructor(options: RetryBudgetOptions) {
    this.maxRetries = options.maxRetries;
    this.window = options.window;
    this.updateResetTime();
  }

  canRetry(): boolean {
    const now = Date.now();

    if (now > this.resetTime) {
      this.reset();
    }

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
