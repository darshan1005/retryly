export interface RetryBudgetOptions {
  /** Maximum number of retries allowed within the window */
  maxRetries: number;
  /** Window duration in milliseconds */
  window: number;
  /** Callback triggered when the budget is exhausted */
  onExhausted?: () => void;
}

export interface RetryBudgetStats {
  remaining: number;
  resetIn: number;
  used: number;
}

export interface RetryBudgetInterface {
  /** Atomically checks and decrements the budget. Returns true if allowed. */
  consume(): boolean;
  /** Returns current stats of the budget */
  getStats(): RetryBudgetStats;
  
  /** Legacy methods (deprecated internally) */
  canRetry?(): boolean;
  recordRetry?(): void;
}
