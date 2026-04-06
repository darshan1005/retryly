import { CircuitBreakerInterface, CircuitBreakerOptions } from './circuit/types';
import { RetryBudgetInterface, RetryBudgetOptions } from './budget/types';

export interface RetryContext {
  attempt: number;
  totalElapsedMs: number;
  policyName?: string;
  strategyDelayMs?: number;
  error?: unknown;
  signal?: AbortSignal;
}

export interface SuccessContext<T> {
  attempt: number;
  totalElapsedMs: number;
  policyName?: string;
  result: T;
}

export interface FailureContext {
  attempt: number;
  totalElapsedMs: number;
  policyName?: string;
  error: unknown;
}

export type DelayStrategy = (attempt: number) => number;

export type RetryCondition = (error: unknown, attempt: number) => boolean;

export interface RetryPolicy {
  retries: number;
  strategy: DelayStrategy;
  shouldRetry: RetryCondition;
}

export interface RetryOptions {
  /** Maximum number of retry attempts */
  retries?: number;
  
  /** Name of a built-in policy or a custom policy configuration */
  policy?: 'httpSafe' | 'networkOnly' | 'aggressive' | 'safe' | string | Partial<RetryPolicy>;
  
  /** Custom delay strategy function */
  strategy?: DelayStrategy;
  
  /** Custom condition to determine if an error should trigger a retry */
  shouldRetry?: RetryCondition;
  
  /** Abort signal to cancel the retry loop */
  signal?: AbortSignal;
  
  /** Hook executed just before a new attempt is made after a failure */
  onRetry?: (context: RetryContext) => void | Promise<void>;
  
  /** Hook executed when the operation succeeds */
  onSuccess?: <T>(context: SuccessContext<T>) => void | Promise<void>;
  
  /** Hook executed when the operation exhausts all retries and fails */
  onFailure?: (context: FailureContext) => void | Promise<void>;

  /** Timeout per attempt in milliseconds */
  attemptTimeout?: number;

  /** Fallback value or async function to return when all retries fail */
  fallback?: unknown | (() => unknown | Promise<unknown>);

  /** Circuit breaker instance or configuration */
  circuitBreaker?: CircuitBreakerOptions | CircuitBreakerInterface;

  /** Retry budget instance or configuration */
  retryBudget?: RetryBudgetOptions | RetryBudgetInterface;

  /** Whether to use adaptive retry delays */
  adaptive?: boolean;

  /** Request hedging configuration */
  hedging?: {
    /** Whether to enable request hedging */
    enabled: boolean;
    /** Delay in milliseconds before launching a duplicate request */
    delay: number;
    /** Maximum number of parallel attempts (default 1) */
    maxHedges?: number;
    /** Concurrency limit for hedging parallel runs */
    concurrencyLimit?: number;
  };

  /** Priority of the request for automated tuning */
  priority?: 'low' | 'normal' | 'high';
}
