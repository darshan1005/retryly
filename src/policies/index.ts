import { RetryPolicy, RetryOptions } from '../types';
import { exponentialStrategy } from '../strategies/exponential';
import { fixedStrategy } from '../strategies/fixed';
import { httpCondition } from '../conditions/http';
import { networkCondition } from '../conditions/network';

/**
 * Built-in retry policies
 */
export const BUILTIN_POLICIES: Record<string, RetryPolicy> = {
  /**
   * Safe for HTTP requests. Retries 5xx errors with exponential backoff.
   */
  httpSafe: {
    retries: 3,
    strategy: exponentialStrategy(1000),
    shouldRetry: httpCondition,
  },

  /**
   * Retries only on network-level errors (ETIMEDOUT, ECONNRESET, etc.).
   */
  networkOnly: {
    retries: 5,
    strategy: exponentialStrategy(500),
    shouldRetry: networkCondition,
  },

  /**
   * Retries almost anything with a high limit and fast fixed delay.
   */
  aggressive: {
    retries: 10,
    strategy: fixedStrategy(100),
    shouldRetry: () => true,
  },

  /**
   * Conservative policy with few retries and long delay.
   */
  safe: {
    retries: 2,
    strategy: exponentialStrategy(2000),
    shouldRetry: (error: any, attempt: number) => httpCondition(error, attempt) || networkCondition(error, attempt),
  },
};

/**
 * Registers a new retry policy by name for runtime reuse.
 */
export function registerPolicy(name: string, policy: RetryPolicy): void {
  if (BUILTIN_POLICIES[name]) {
    throw new Error(`Policy '${name}' is already registered. Use a unique name.`);
  }
  BUILTIN_POLICIES[name] = policy;
}

/**
 * Resolves a policy from options.
 * Matches built-in policy names or merges custom policy objects.
 */
export function resolvePolicy(options: RetryOptions): RetryPolicy {
  const { policy, retries, strategy, shouldRetry } = options;

  let basePolicy: RetryPolicy;

  if (typeof policy === 'string') {
    if (!BUILTIN_POLICIES[policy]) {
      throw new Error(`Unknown retry policy: '${policy}'. Use registerPolicy() to add custom policies.`);
    }
    basePolicy = BUILTIN_POLICIES[policy];
  } else if (policy && typeof policy === 'object') {
    // If a partial policy is provided, start with 'safe' as default and merge
    basePolicy = {
      ...BUILTIN_POLICIES.safe,
      ...policy,
    };
  } else {
    basePolicy = BUILTIN_POLICIES.safe;
  }

  // Final overrides from top-level options
  return {
    retries: retries ?? basePolicy.retries,
    strategy: strategy ?? basePolicy.strategy,
    shouldRetry: shouldRetry ?? basePolicy.shouldRetry,
  };
}
