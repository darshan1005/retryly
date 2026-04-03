# Retryly

A production-grade, policy-driven TypeScript retry package.

## Problem Statement
Retrying failed operations (especially network requests) shouldn't be a random guess. `retryly` provides a structured way to handle failures using a "Policy-First" approach, ensuring that your retry logic is predictable, cancellable, and efficient.

## Why not `p-retry`?
While `p-retry` is excellent, `retryly` offers several advantages:
- **Built-in Policies**: Instead of configuring retries every time, use pre-defined policies like `httpSafe` or `networkOnly`.
- **First-class Cancellation**: Deep integration with `AbortSignal` across the entire retry loop and delay intervals.
- **Strong Typing**: 100% TypeScript with refined context for success and failure lifecycle hooks.
- **Strategy Modularity**: Easily wrap strategies with jitter or combine them without boilerplate.

## Policy System
The core differentiator of `retryly` is its Policy System. A policy defines:
- How many times to retry.
- The delay strategy to use.
- A condition function to decide if a specific error is retryable.

## Installation

```bash
npm install retryly
```

## Examples

### Basic Usage
```typescript
import { retry } from 'retryly';

const result = await retry(async () => {
  return await fetchData();
}, { retries: 5 });
```

### HTTP-Safe Policy (Retries 5xx, Skips 4xx)
```typescript
import { retry } from 'retryly';

const data = await retry(fetchMyData, {
  policy: 'httpSafe'
});
```

### Custom Strategy with Jitter
```typescript
import { retry, exponentialStrategy, withJitter } from 'retryly';

const customStrategy = withJitter(exponentialStrategy(1000, 2), 0.2);

await retry(doSomething, {
  strategy: customStrategy,
  retries: 3
});
```

### Cancellation with AbortSignal
```typescript
const controller = new AbortController();

// This will stop retrying and clear any active delay timers immediately
const promise = retry(task, { signal: controller.signal });

controller.abort();
```

## Circuit Breaker

The Circuit Breaker protects your system from cascading failures by stopping requests to an already failing downstream service.

### States
- **CLOSED**: The circuit is functional and allowing requests. Failures are tracked.
- **OPEN**: The state reached after the `failureThreshold` is exceeded. All requests are blocked for the duration of the `resetTimeout`.
- **HALF_OPEN**: After the timeout, the circuit allows a limited number of requests (defined by `successThreshold`) to test if the service has recovered.

### Usage Examples

#### Basic Configuration
```typescript
await retry(fn, {
  policy: "httpSafe",
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 10000 // 10 seconds
  }
});
```

#### Shared Circuit (Recommended for microservices)
Using a shared instance ensures that multiple distinct calls to the same failing service are all blocked together.
```typescript
import { retry, CircuitBreaker } from 'retryly';

const apiCircuit = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });

// Both calls share the same failure state
await retry(fetchUsers, { circuitBreaker: apiCircuit });
await retry(fetchPosts, { circuitBreaker: apiCircuit });
```

> [!WARNING]
> Do not use a shared circuit breaker for unrelated services, as failures in one service will block requests to the other.

## Retry Budget

A Retry Budget prevents "retry storms" by limiting the total number of retries allowed over a sliding time window. This is essential for protecting your infrastructure during high-load failure scenarios.

### Configuration
```typescript
await retry(fn, {
  retryBudget: {
    maxRetries: 10,   // Max 10 retries...
    window: 60000    // ...per minute
  }
});
```

### Shared Budget
Highly recommended for shared resources (e.g., all calls to a specific database).
```typescript
const dbBudget = new RetryBudget({ maxRetries: 100, window: 60000 });

await retry(query1, { retryBudget: dbBudget });
await retry(query2, { retryBudget: dbBudget });
```

## Adaptive Retry

Adaptive mode automatically adjusts backoff delays based on the error type:
- **Rate Limited (429)**: Uses a slow, aggressive exponential backoff.
- **Network Errors**: Uses a fast, tactical backoff for transient blips.
- **Service Errors (5xx)**: Uses standard exponential backoff.

### Usage
```typescript
await retry(apiCall, { adaptive: true });
```

## Request Hedging

Request hedging (predictive retries) reduces tail latency by launching a duplicate request if the original has not responded within a certain threshold.

### Configuration
```typescript
await retry(fetchData, {
  hedging: {
    enabled: true,
    delay: 200,      // Launch hedge after 200ms
    maxHedges: 1     // Launch at most 1 hedge
  }
});
```
> [!CAUTION]
> Hedging increases the total load on your downstream services. Use it only for slow, idempotent APIs and monitor your infrastructure closely.

## Priority System

The Priority System allows you to tune the library's sensitivity based on the importance of the request.

- **`high`**: Faster delays (50% reduction) and more retries (+2).
- **`low`**: Slower delays (50% increase) and fewer retries (-1).
- **`normal`**: Default behavior.

### Usage
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
  const data = await retry(fetchData, {
    policy: 'httpSafe',
    priority: 'high',
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
    // Handle circuit open (e.g. return cached data)
  }
}
```

## API Reference

### `retry(fn, options)`
- `fn`: An async function to execute.
- `options`:
    - `retries`: Max retry count.
    - `policy`: Name of built-in policy (`httpSafe`, `networkOnly`, `aggressive`, `safe`) or a custom policy object.
    - `strategy`: A function `(attempt: number) => number`.
    - `shouldRetry`: A function `(error: unknown, attempt: number) => boolean`.
    - `signal`: An `AbortSignal`.
    - `onRetry`, `onSuccess`, `onFailure`: Lifecycle hooks.

## Safety Warning (Idempotency)
**IMPORTANT**: Only retry operations that are **idempotent**. Retrying a non-idempotent operation (like a non-idempotent POST request) can result in duplicate data or side effects if the previous attempt actually succeeded but failed to return a response.

## License
MIT
