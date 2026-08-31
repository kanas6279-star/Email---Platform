// Minimal in-memory sliding-window rate limiter. Good enough for a single
// server instance / local dev. Replace with a Redis-backed limiter (e.g.
// Upstash) before running multiple server instances in production.

const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter(
    (t) => now - t < windowMs
  );

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, remaining: maxRequests - timestamps.length };
}

export function clientKeyFromRequest(req: Request, extra = "") {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "unknown";
  return `${ip}:${extra}`;
}
