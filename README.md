# retry-pro

A production-grade, policy-driven TypeScript retry library.

[![NPM Version](https://img.shields.io/npm/v/retry-pro.svg)](https://www.npmjs.com/package/retry-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/darshan1005/retry-pro)

## Overview

`retry-pro` provides a structured, composable approach to retrying failed async operations. Instead of re-implementing retry logic per call site, it gives you a **Policy-First** model that is predictable, cancellable, observability-ready, and safe for production at scale.

**Key properties:**
- Zero runtime dependencies
- Full TypeScript types with strict mode
- Works in Node.js and browsers (separate browser bundle)
- Tree-shakable ESM + CJS dual output

---

## Installation
```bash
npm install retry-pro
```

---

## Quick Start
```typescript
import { retry } from 'retry-pro';

const result = await retry(async (signal) => {
  return await fetch('/api/data', { signal }).then(r => r.json());
}, { retries: 3 });
```

> **Always forward the `signal` argument** into your async operation. This enables clean cancellation and hedging.

---

## Built-in Policies

Policies bundle a retry count, delay strategy, and retry condition together. Pass a policy name instead of configuring everything manually.

| Policy | Retries | Strategy | Retries On |
|---|---|---|---|
| `httpSafe` | 3 | Exponential (1000ms base) | 5xx only |
| `networkOnly` | 5 | Exponential (500ms base) | Network errors (ECONNRESET, ETIMEDOUT, etc.) |
| `aggressive` | 10 | Fixed (100ms) | Everything |
| `safe` | 2 | Exponential (2000ms base) | 5xx + network errors |
```typescript
const data = await retry(fetchMyData, { policy: 'httpSafe' });
```

### Register Custom Policies
```typescript
import { registerPolicy, exponentialStrategy, retry } from 'retry-pro';

registerPolicy('databaseFailover', {
  retries: 3,
  strategy: exponentialStrategy(500, 2, 10000), // base 500ms, factor 2, max 10s
  shouldRetry: (err) => err.code === 'ECONNRESET'
});

await retry(queryDb, { policy: 'databaseFailover' });
```

> Attempting to register a policy name that already exists will throw an error.

---

## Delay Strategies

Strategies control how long to wait between attempts. All strategies cap at `maxDelay` (default: 30,000ms).

### Exponential
```typescript
import { exponentialStrategy } from 'retry-pro';
// delay = base * (factor ^ attempt), capped at maxDelay
exponentialStrategy(baseDelay: number, factor?: number, maxDelay?: number)
// e.g. exponentialStrategy(1000) → 1000, 2000, 4000, 8000...
```

### Linear
```typescript
import { linearStrategy } from 'retry-pro';
// delay = base + (increment * attempt)
linearStrategy(baseDelay: number, increment: number, maxDelay?: number)
// e.g. linearStrategy(200, 100) → 200, 300, 400...
```

### Fixed
```typescript
import { fixedStrategy } from 'retry-pro';
// delay = constant
fixedStrategy(delay: number, maxDelay?: number)
// e.g. fixedStrategy(500) → 500, 500, 500...
```

### With Jitter

Wraps any strategy to add randomized variance, preventing thundering herd problems.
```typescript
import { withJitter, exponentialStrategy } from 'retry-pro';
// delay = baseDelay + (baseDelay * jitterFactor * random)
withJitter(strategy, jitterFactor?: number, maxDelay?: number)
// e.g. withJitter(exponentialStrategy(1000), 0.2)
```

---

## Core Options Reference
```typescript
await retry(fn, {
  retries: 3,                    // Max retry attempts
  policy: 'httpSafe',            // Built-in or custom policy name
  strategy: fixedStrategy(500),  // Delay strategy (overrides policy's)
  shouldRetry: (err) => true,    // Condition to retry (overrides policy's)
  signal: controller.signal,     // AbortSignal for cancellation
  attemptTimeout: 5000,          // Hard timeout per attempt (ms)
  fallback: () => defaultValue,  // Value or async fn when all retries fail
  adaptive: true,                // Adaptive delay based on error type
  priority: 'high',              // 'low' | 'normal' | 'high'
  onRetry: async (ctx) => {},    // Hook before each retry
  onSuccess: async (ctx) => {},  // Hook on success
  onFailure: async (ctx) => {},  // Hook on final failure
});
```

---

## Lifecycle Hooks

All hooks receive a rich context object.
```typescript
await retry(fn, {
  retries: 3,
  onRetry: async ({ attempt, strategyDelayMs, totalElapsedMs, error }) => {
    console.warn(`Attempt ${attempt} failed. Retrying in ${strategyDelayMs}ms. Elapsed: ${totalElapsedMs}ms`);
  },
  onSuccess: async ({ attempt, totalElapsedMs, result }) => {
    console.log(`Succeeded on attempt ${attempt}`);
  },
  onFailure: async ({ attempt, totalElapsedMs, error }) => {
    console.error(`All retries exhausted after ${attempt} attempts`, error);
  }
});
```

---

## Cancellation (AbortSignal)

Pass an `AbortSignal` to cancel the entire retry loop, including any active delay intervals.
```typescript
const controller = new AbortController();

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10000);

try {
  await retry(fn, { signal: controller.signal, retries: 10 });
} catch (err) {
  if (err instanceof AbortError) {
    console.log('Operation was cancelled');
  }
}
```

---

## Fallbacks & Attempt Timeouts
```typescript
const result = await retry(fetchPrices, {
  retries: 2,
  attemptTimeout: 5000,                          // Reject any attempt taking > 5s
  fallback: () => ({ cached: true, price: 50 }) // Returned after all retries fail
});
```

---

## Adaptive Delay

When `adaptive: true`, the delay strategy is determined automatically by inspecting the error:

| Error Type | Strategy |
|---|---|
| Rate limited (429) | Slow exponential (`1000 * 3^attempt`) or uses `Retry-After` header |
| Network error (ECONNRESET, ETIMEDOUT, etc.) | Fast incremental (`100 * (attempt + 1)`) |
| Everything else | Standard exponential (`1000 * 2^attempt`) |
```typescript
await retry(apiCall, { adaptive: true });
```

---

## Circuit Breaker

Prevents cascading failures by stopping requests to a known-failing service. Uses a rolling failure window.
```typescript
import { retry, CircuitBreaker } from 'retry-pro';

const circuit = new CircuitBreaker({
  failureThreshold: 3,   // Open after 3 failures
  resetTimeout: 30000,   // Try again after 30s (HALF_OPEN)
  successThreshold: 2,   // Require 2 successes to fully close
  window: 60000          // Only count failures within last 60s
});

await retry(fetchUsers, { circuitBreaker: circuit });
```

**States:** `CLOSED` → `OPEN` → `HALF_OPEN` → `CLOSED`

- The circuit only opens on **final** failures (after all retries), not intermediate ones.
- You can also pass raw `CircuitBreakerOptions` and an instance will be created for you.
```typescript
await retry(fn, {
  circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 }
});
```

---

## Retry Budget

Prevents retry storms by capping the total retries allowed across multiple calls in a rolling time window.
```typescript
import { retry, RetryBudget } from 'retry-pro';

const budget = new RetryBudget({ maxRetries: 50, window: 60000 });

// All retry() calls sharing this budget instance will collectively
// be limited to 50 retries per 60 seconds.
await retry(queryCluster, { retryBudget: budget });
```

**Methods available on `RetryBudget`:**
```typescript
budget.canRetry()    // → boolean
budget.consume()     // Atomically checks and decrements; returns boolean
budget.getStats()    // → { remaining, resetIn, used }
budget.reset()       // Manually reset the window
```

You can also supply options directly and an instance will be created internally:
```typescript
await retry(fn, { retryBudget: { maxRetries: 50, window: 60000 } });
```

---

## Request Hedging

Launches a duplicate request if the original hasn't responded within a threshold, resolving with whichever completes first. Losers are automatically aborted.
```typescript
await retry(async (signal) => fetch('/data', { signal }), {
  hedging: {
    enabled: true,
    delay: 200,          // Launch a hedge after 200ms
    maxHedges: 1,        // Max number of duplicate requests (default: 1)
    concurrencyLimit: 20 // Global limit on simultaneous hedge requests
  }
});
```

> ⚠️ **Only use hedging on idempotent operations.** It increases load on downstream services.

---

## Priority System

Automatically tunes retry count and delays without manual configuration.

| Priority | Retries | Delay |
|---|---|---|
| `high` | +2 | ×0.5 (50% faster) |
| `normal` | unchanged | unchanged |
| `low` | −1 (min 0) | ×1.5 (50% slower) |
```typescript
await retry(criticalAction, { priority: 'high' });
await retry(backgroundTask, { priority: 'low' });
```

---

## Error Types
```typescript
import { AbortError, RetryError, CircuitOpenError } from 'retry-pro';

try {
  await retry(fn, { retries: 3 });
} catch (err) {
  if (err instanceof AbortError) { /* cancelled */ }
  if (err instanceof RetryError) {
    console.log(err.attempts);   // How many attempts were made
    console.log(err.lastError);  // The underlying error
  }
  if (err instanceof CircuitOpenError) { /* circuit is open */ }
}
```

---

## OpenTelemetry Integration

Import from the `retry-pro/otel` sub-path to avoid bundling OTEL into your main bundle.
```typescript
import { withTracing } from 'retry-pro/otel';

const data = await withTracing(fetchDatabase, retryOptions, yourOtelTracer);
```

Emits span events on each retry attempt and sets the span status to `OK` or `ERROR` on completion.

---

## Production Example
```typescript
import { retry, CircuitBreaker, RetryBudget } from 'retry-pro';

const circuit = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });
const budget = new RetryBudget({ maxRetries: 50, window: 60000 });

try {
  const data = await retry(async (signal) => axios.get('/api', { signal }), {
    policy: 'httpSafe',
    priority: 'high',
    attemptTimeout: 5000,
    adaptive: true,
    hedging: { enabled: true, delay: 250 },
    circuitBreaker: circuit,
    retryBudget: budget,
    onRetry: ({ attempt, strategyDelayMs }) => {
      logger.warn(`Retry ${attempt}, waiting ${strategyDelayMs}ms`);
    }
  });
} catch (err) {
  if (err instanceof CircuitOpenError) {
    // Serve from cache or degrade gracefully
  }
}
```

---

## Safety: Idempotency

> ⚠️ **Only retry idempotent operations.** If a `POST` request creates a record but times out before returning a response, retrying it will create a duplicate. Use retry only for safe operations (reads, or writes protected by idempotency keys).

---

## License

MIT
