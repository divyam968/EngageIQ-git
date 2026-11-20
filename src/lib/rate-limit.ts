interface RateLimitBucket {
  startedAt: number
  count: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

const WINDOW_MS = 60_000
const MAX_BUCKETS = 10_000
const buckets = new Map<string, RateLimitBucket>()

export function checkRequestRateLimit(
  key: string,
  limit: number,
  now = Date.now(),
): RateLimitResult {
  for (const [bucketKey, bucket] of buckets) {
    if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(bucketKey)
  }

  let bucket = buckets.get(key)
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value
      if (oldestKey !== undefined) buckets.delete(oldestKey)
    }
    bucket = { startedAt: now, count: 0 }
    buckets.set(key, bucket)
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((WINDOW_MS - (now - bucket.startedAt)) / 1000),
      ),
    }
  }

  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}
