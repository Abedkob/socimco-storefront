import { ApiError } from "@/core/contract";

interface Bucket {
  count: number;
  resetAtMs: number;
}

export interface RateLimiter {
  /** Throws RATE_LIMITED if the bucket is full, without counting this call. */
  assert(key: string, limit: number, windowMs: number): void;
  /** Counts this call, throwing RATE_LIMITED first if the bucket is full. */
  hit(key: string, limit: number, windowMs: number): void;
  record(key: string, windowMs: number): void;
  reset(key: string): void;
}

const MAX_BUCKETS = 10_000;

export function createRateLimiter(nowMs: () => number): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function bucket(key: string, windowMs: number): Bucket {
    const t = nowMs();
    let b = buckets.get(key);
    if (!b || t >= b.resetAtMs) {
      if (buckets.size >= MAX_BUCKETS) {
        for (const [k, v] of buckets) if (t >= v.resetAtMs) buckets.delete(k);
      }
      b = { count: 0, resetAtMs: t + windowMs };
      buckets.set(key, b);
    }
    return b;
  }

  const limiter: RateLimiter = {
    assert(key, limit, windowMs) {
      const b = bucket(key, windowMs);
      if (b.count >= limit) {
        throw new ApiError("RATE_LIMITED", {
          details: { retryAfterSeconds: Math.max(1, Math.ceil((b.resetAtMs - nowMs()) / 1000)) },
        });
      }
    },
    hit(key, limit, windowMs) {
      limiter.assert(key, limit, windowMs);
      bucket(key, windowMs).count++;
    },
    record(key, windowMs) {
      bucket(key, windowMs).count++;
    },
    reset(key) {
      buckets.delete(key);
    },
  };
  return limiter;
}
