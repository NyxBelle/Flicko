/**
 * Rate limiting via Upstash Redis.
 * Falls back to allow-all when UPSTASH_REDIS_REST_URL / TOKEN are not set,
 * so the app works in dev and on first deploy without breaking.
 *
 * Env vars required in Railway (frontend service):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Free tier at upstash.com — create a Redis database, copy the REST URL + token.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSecs: number;
  /** Key prefix to namespace limits (e.g. "process", "perf") */
  prefix: string;
}

export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Graceful no-op when Upstash is not configured
  if (!url || !token) {
    return { allowed: true };
  }

  // Identify user by JWT sub (from Supabase cookie) or fall back to IP
  const userId =
    req.cookies.get("sb-access-token")?.value?.split(".")[1] ?? // JWT payload (base64)
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";

  const key = `rl:${config.prefix}:${userId}`;

  try {
    // INCR + EXPIRE in a single pipeline using Upstash REST API
    const pipeline = [
      ["INCR", key],
      ["EXPIRE", key, config.windowSecs],
    ];

    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) return { allowed: true }; // fail open

    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 0;

    if (count > config.limit) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          {
            status: 429,
            headers: {
              "Retry-After": String(config.windowSecs),
              "X-RateLimit-Limit": String(config.limit),
              "X-RateLimit-Remaining": "0",
            },
          },
        ),
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open — never block on rate-limit errors
  }
}
