# Retryly

A production-grade, policy-driven TypeScript retry package.

[![NPM Version](https://img.shields.io/npm/v/memcachify.svg)](https://www.npmjs.com/package/retryly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/darshan1005/retryly)

## Problem Statement
Retrying failed operations (especially network requests) shouldn't be a random guess. `retryly` provides a structured way to handle failures using a "Policy-First" approach, ensuring that your retry logic is predictable, cancellable, observability-ready, and efficient.

## Why not `p-retry`?
While `p-retry` is excellent, `retryly` offers profound advantages for production architectures:
- **Built-in Policies**: Instead of configuring retries every time, use pre-defined policies (or register your own!).
- **Middleware Pipeline**: Circuit breakers, hedging, retry budgets, and timeouts are composed seamlessly in a high-performance execution loop.
- **First-class Cancellation**: Deep integration with `AbortSignal` across the entire retry loop, delay intervals, and native hedging bindings.
- **OpenTelemetry Ready**: Opt-in zero-dependency robust OTEL metric capturing natively inside your traces.

## Installation

```bash
npm install retryly
```

## Basic Examples

### Simple Usage
```typescript
import { retry } from 'retryly';

const result = await retry(async (signal) => {
  // Propagate the signal to ensure cancellations and hedging work!
  return await fetchData(signal); 
}, { retries: 5 });
```

### HTTP-Safe Policy (Retries 5xx, Skips 4xx)
```typescript
import { retry } from 'retryly';

const data = await retry(fetchMyData, {
  policy: 'httpSafe'
});
```

### Runtime Custom Policies
Define global shared policies explicitly across your app.
```typescript
import { registerPolicy, exponentialStrategy, retry } from 'retryly';

registerPolicy('databaseFailover', {
  retries: 3,
  strategy: exponentialStrategy(500, 2, 10000), // Base 500ms, max 10s
  shouldRetry: (err) => err.code === 'ECONNRESET'
});

await retry(queryDb, { policy: 'databaseFailover' });
```

## Advanced Features

### Fallbacks & Attempt Timeouts
Ensure requests never hang your pipeline natively.
```typescript
const result = await retry(fetchPrices, {
  retries: 2,
  attemptTimeout: 5000,    // Hard crash each attempt if it takes > 5s
  fallback: () => ({ cached: true, price: 50 }) // Safety value after exhaustion
});
```

### Lifecycle Context Hooks
A rich contextual payload drives all hooks out-of-the-box.
```typescript
await retry(fn, {
  retries: 3,
  onRetry: async ({ attempt, strategyDelayMs, totalElapsedMs, error }) => {
    console.warn(`Retrying in ${strategyDelayMs}ms. Running for ${totalElapsedMs}ms.`);
  },
  onFailure: async (ctx) => {
    console.error(`Final failure after ${ctx.attempt} attempts!`, ctx.error);
  }
});
```

### Circuit Breaker

The Circuit Breaker protects your system from cascading failures by stopping requests to an already failing downstream service.

```typescript
import { retry, CircuitBreaker } from 'retryly';

const apiCircuit = new CircuitBreaker({ 
    failureThreshold: 3, 
    resetTimeout: 30000,
    window: 60000 // Only count failures within a rolling 60s window
});

await retry(fetchUsers, { circuitBreaker: apiCircuit });
```

### Retry Budget

A Retry Budget prevents "retry storms" by limiting the total number of retries allowed over a sliding time window. 
```typescript
import { retry, RetryBudget } from 'retryly';

const dbBudget = new RetryBudget({ maxRetries: 50, window: 60000 });

// If DB goes fully down, we stop spamming after ~50 global retries
await retry(queryCluster, { retryBudget: dbBudget });
```

### Adaptive Delay Strategy

Adaptive mode automatically adjusts backoff delays based on error context by deeply inspecting error types and `Retry-After` HTTP headers:
- **Rate Limited (429)**: Backs off precisely using header timestamps/seconds.
- **Network Errors**: Uses a fast, tactical backoff for transient blips.
- **Service Errors (5xx)**: Uses standard exponential backoff.

```typescript
await retry(apiCall, { adaptive: true });
```

### Request Hedging

Request hedging (predictive retries) reduces tail latency by launching a duplicate request if the original has not responded within a certain threshold. The first request to fulfill resolves the promise and automatically `aborts` the lagging requests.

```typescript
await retry(async (signal) => fetch('/data', { signal }), {
  hedging: {
    enabled: true,
    delay: 200,             // Launch alternate request after 200ms
    concurrencyLimit: 20    // Restrict global parallel hedges
  }
});
```
> [!CAUTION]
> Hedging increases the total load on your downstream services. Use it only for safe, idempotent operations.

### OpenTelemetry Integration

Wrap traces smoothly safely importing the sub-module.
```typescript
import { withTracing } from 'retryly/otel';
import { retryOptions } from './config';

// Start operations, emitting Span events upon successful completion or delay.
const data = await withTracing(fetchDatabase, retryOptions, yourOtelTracer);
```

## Priority System

The Priority System allows you to tune the library's sensitivity based on the importance of the request.

- **`high`**: Faster delays (50% reduction) and more retries (+2).
- **`low`**: Slower delays (50% increase) and fewer retries (-1).
- **`normal`**: Default behavior.

```typescript
await retry(criticalAction, { priority: 'high' });
```

## Combined Example (Production Ready)

For critical production services, combining all features provides maximum resilience:

```typescript
import { retry, CircuitBreaker, RetryBudget } from 'retryly';

const apiCircuit = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });
const apiBudget = new RetryBudget({ maxRetries: 50, window: 60000 });

try {
  const data = await retry(async (signal) => axios.get('/api', { signal }), {
    policy: 'httpSafe',
    priority: 'high',
    attemptTimeout: 5000,
    hedging: {
      enabled: true,
      delay: 250
    },
    circuitBreaker: apiCircuit,
    retryBudget: apiBudget,
    adaptive: true
  });
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Handle circuit open
  }
}
```

## Safety Warning (Idempotency)
**IMPORTANT**: Only retry operations that are **idempotent**. Retrying a non-idempotent operation (like a POST request creating records) can result in duplicate logic executing if the previous attempt actually succeeded but failed to return a response gracefully due to a network timeout.

## License
MIT
