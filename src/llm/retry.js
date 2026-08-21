// Stage 4 retry policy.
//
// Retry: timeouts, 429 (rate limited), 5xx (server-side problem).
// Never retry: 400, 401, 403 — a bad request or a bad key is still bad
// four seconds later, and on a metered free tier every pointless retry
// burns real quota.

function isTimeoutError(err) {
  return err?.name === "APIConnectionTimeoutError" || err?.code === "ETIMEDOUT";
}

function isRetryableError(err) {
  if (isTimeoutError(err)) return true;

  if (typeof err?.status === "number") {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) return true;
    return false; // 400, 401, 403, 404, etc. — never retry these
  }

  return false;
}

function getRetryAfterMs(err) {
  const retryAfterHeader = err?.headers?.["retry-after"];
  if (!retryAfterHeader) return null;

  const seconds = parseInt(retryAfterHeader, 10);
  return Number.isNaN(seconds) ? null : seconds * 1000;
}

function backoffWithJitter(attempt) {
  const base = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
  const jitter = Math.random() * 500;
  return base + jitter;
}

async function withRetry(fn, { maxRetries = 2 } = {}) {
  let attempt = 0;
  let lastErr;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isRetryableError(err) || attempt === maxRetries) {
        throw err;
      }

      const waitMs = getRetryAfterMs(err) ?? backoffWithJitter(attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempt += 1;
    }
  }

  throw lastErr;
}

module.exports = { withRetry, isRetryableError, isTimeoutError };