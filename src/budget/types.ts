export interface RetryBudgetOptions {
  /** Maximum number of retries allowed within the window */
  maxRetries: number;
  /** Window duration in milliseconds */
  window: number;
}

export interface RetryBudgetInterface {
  /** Returns true if a retry attempt is allowed within the current budget */
  canRetry(): boolean;
  /** Records a retry attempt in the current budget */
  recordRetry(): void;
}
