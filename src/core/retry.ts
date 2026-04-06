import { RetryOptions, FailureContext, RetryContext, SuccessContext } from '../types';
import { resolvePolicy } from '../policies';
import { delay } from '../utils/delay';
import { checkSignal, AbortError, RetryError, CircuitOpenError } from '../utils/errors';
import { resolveCircuit } from '../circuit/resolver';
import { resolveRetryBudget } from '../budget/resolver';
import { adaptiveDelay } from '../adaptive/strategy';
import { executeWithHedging } from '../hedging/executor';
import { resolvePriority } from '../priority/resolver';

export interface RetryMiddleware {
  name: string;
  beforeAttempt?: (ctx: RetryContext) => void | Promise<void>;
  afterSuccess?: <T>(ctx: SuccessContext<T>) => void | Promise<void>;
  afterFailure?: (ctx: FailureContext) => void | Promise<void>;
  execute?: <T>(ctx: RetryContext, next: () => Promise<T>) => Promise<T>;
}

/**
 * Executes an asynchronous function with retry logic based on the provided options.
 * 
 * @param fn Operation to retry
 * @param options Retry options and policy configuration
 * @returns Result of the function
 */
export async function retry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = resolvePriority(options);
  const policy = resolvePolicy(opts);
  const circuit = resolveCircuit(opts);
  const budget = resolveRetryBudget(opts);
  const { onRetry, onSuccess, onFailure, signal, attemptTimeout, fallback, adaptive } = opts;
  const policyName = typeof opts.policy === 'string' ? opts.policy : undefined;
  
  const startTime = Date.now();
  let lastError: unknown;

  // Build pipeline
  const middlewares: RetryMiddleware[] = [];

  // 1. Budget Middleware
  if (budget) {
    middlewares.push({
      name: 'Budget',
      beforeAttempt: (ctx) => {
        if (ctx.attempt > 0 && !budget.consume()) {
          throw new Error('Retry budget exhausted');
        }
      }
    });
  }

  // 2. Circuit Breaker Middleware
  if (circuit) {
    middlewares.push({
      name: 'CircuitBreaker',
      beforeAttempt: () => {
        if (!circuit.canExecute()) throw new CircuitOpenError();
      },
      afterSuccess: () => circuit.onSuccess(),
      afterFailure: (ctx) => {
        // Only trigger failure on the last attempt or if we shouldn't retry
        if (ctx.attempt === policy.retries || !policy.shouldRetry(ctx.error, ctx.attempt)) {
            circuit.onFailure();
        }
      }
    });
  }

  // 3. Hooks Middleware
  middlewares.push({
    name: 'Hooks',
    afterSuccess: async (ctx) => {
      if (onSuccess) await onSuccess(ctx);
    },
    afterFailure: async (ctx) => {
      const isLastAttempt = ctx.attempt === policy.retries;
      const shouldRetry = policy.shouldRetry(ctx.error, ctx.attempt);
      if (isLastAttempt || !shouldRetry) {
        if (onFailure) await onFailure(ctx);
      }
    }
  });

  // Compose execution
  const executeAttempt = async (ctx: RetryContext): Promise<T> => {
    let currentExecute = async () => {
      // Wrap fn with timeout
      const fnWithTimeout = async (sig?: AbortSignal) => {
        if (!attemptTimeout) return fn(sig);
        return new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Attempt timed out after ${attemptTimeout}ms`)), attemptTimeout);
          fn(sig).then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
          );
        });
      };

      return executeWithHedging(fnWithTimeout, opts, circuit, budget);
    };

    // Apply execute middlewares inside out
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const m = middlewares[i];
      if (m.execute) {
        const next = currentExecute;
        currentExecute = () => m.execute!(ctx, next);
      }
    }
    return currentExecute();
  };

  // Run the retry loop
  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    const ctx: RetryContext = {
      attempt,
      totalElapsedMs: Date.now() - startTime,
      policyName,
      signal
    };

    try {
      checkSignal(signal);

      // Run beforeAttempt hooks
      for (const m of middlewares) {
        if (m.beforeAttempt) await m.beforeAttempt(ctx);
      }

      const result = await executeAttempt(ctx);

      const successCtx: SuccessContext<T> = {
        attempt,
        totalElapsedMs: Date.now() - startTime,
        policyName,
        result
      };

      for (const m of middlewares) {
        if (m.afterSuccess) await m.afterSuccess(successCtx);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      if (error?.name === 'AbortError' || error instanceof AbortError) {
        for (const m of middlewares) {
            if (m.afterFailure) await m.afterFailure({ attempt, totalElapsedMs: Date.now() - startTime, policyName, error });
        }
        throw error;
      }

      if (error instanceof CircuitOpenError || error.message === 'Retry budget exhausted') {
        throw error;
      }

      const isLastAttempt = attempt === policy.retries;
      const shouldRetry = policy.shouldRetry(error, attempt);

      const failureCtx: FailureContext = {
        attempt,
        totalElapsedMs: Date.now() - startTime,
        policyName,
        error
      };

      for (const m of middlewares) {
        if (m.afterFailure) await m.afterFailure(failureCtx);
      }

      if (isLastAttempt || !shouldRetry) {
        if (isLastAttempt && fallback !== undefined) {
          return typeof fallback === 'function' ? await fallback() : fallback as T;
        }
        
        if (isLastAttempt) {
            throw new RetryError(`Operation failed after ${attempt} retries: ${error.message || 'Unknown error'}`, attempt, error);
        }
        throw error;
      }

      const delayMs = adaptive ? adaptiveDelay(error, attempt) : policy.strategy(attempt);
      ctx.strategyDelayMs = delayMs;
      ctx.error = error;
      ctx.totalElapsedMs = Date.now() - startTime;

      if (onRetry) {
        await onRetry(ctx);
      }

      await delay(delayMs, signal);
    }
  }

  throw lastError;
}
