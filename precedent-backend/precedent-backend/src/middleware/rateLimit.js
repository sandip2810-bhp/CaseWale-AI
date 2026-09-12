// Simple in-memory sliding-window rate limiter, keyed per user (falls
// back to IP for unauthenticated requests). No Redis needed — good
// enough for a single-instance deployment. If you ever run multiple
// instances behind a load balancer, swap this for a shared store
// (Redis, etc.) or the limits won't be enforced consistently.

function rateLimit({ windowMs = 60 * 1000, max = 10, message } = {}) {
    const hits = new Map(); // key -> array of timestamps

    // Periodically clear out stale keys so this doesn't grow forever.
    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, timestamps] of hits.entries()) {
            const recent = timestamps.filter((t) => t > cutoff);
            if (recent.length === 0) hits.delete(key);
            else hits.set(key, recent);
        }
    }, windowMs).unref?.();

    return function rateLimitMiddleware(req, res, next) {
        const key = req.userId || req.ip;
        const now = Date.now();
        const cutoff = now - windowMs;

        const timestamps = (hits.get(key) || []).filter((t) => t > cutoff);
        timestamps.push(now);
        hits.set(key, timestamps);

        if (timestamps.length > max) {
            const retryAfterSec = Math.ceil(
                (timestamps[0] + windowMs - now) / 1000
            );
            res.set("Retry-After", String(retryAfterSec));
            return res.status(429).json({
                error:
                    message ||
                    `Too many requests. Please try again in ${retryAfterSec}s.`,
            });
        }

        next();
    };
}

module.exports = rateLimit;
