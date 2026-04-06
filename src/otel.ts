import { RetryOptions, RetryContext, SuccessContext, FailureContext } from './types';
import { retry } from './core/retry';

export interface TracerLike {
  startActiveSpan(name: string, fn: (span: SpanLike) => Promise<any>): Promise<any>;
}

export interface SpanLike {
  addEvent(name: string, attributes?: any): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

export const SpanStatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2
};

/**
 * Executes a retry routine wrapped in an OpenTelemetry active span.
 * 
 * @param fn Operation to retry
 * @param options Retry options
 * @param tracer OpenTelemetry tracer instance
 */
export function withTracing<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions,
  tracer: TracerLike
): Promise<T> {
  return tracer.startActiveSpan('retryly.retry', async (span) => {
    try {
      const result = await retry(fn, {
        ...options,
        onRetry: async (ctx: RetryContext) => {
          span.addEvent('retry', { attempt: ctx.attempt, delay: ctx.strategyDelayMs });
          if (options.onRetry) {
            await options.onRetry(ctx);
          }
        },
        onSuccess: async <U>(ctx: SuccessContext<U>) => {
          span.setStatus({ code: SpanStatusCode.OK });
          if (options.onSuccess) {
            await options.onSuccess(ctx);
          }
        },
        onFailure: async (ctx: FailureContext) => {
          span.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: ctx.error instanceof Error ? ctx.error.message : 'Unknown error' 
          });
          if (options.onFailure) {
            await options.onFailure(ctx);
          }
        }
      });
      return result;
    } finally {
      span.end();
    }
  });
}
