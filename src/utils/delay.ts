import { AbortError } from './errors';

/**
 * Resolves after a given number of milliseconds, or rejects if an AbortSignal is aborted.
 */
export const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new AbortError(signal.reason));
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new AbortError(signal.reason));
    }, { once: true });
  });
};
