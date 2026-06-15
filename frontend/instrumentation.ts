/**
 * Sentry error tracking — Next.js instrumentation hook.
 * Runs on both server and client (edge/node runtimes).
 *
 * Setup:
 *   1. npm install @sentry/nextjs
 *   2. Add to Railway (frontend):  SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/YYY
 *   3. Get DSN from sentry.io → your project → Settings → Client Keys
 *
 * When SENTRY_DSN is not set this file is a no-op — safe for dev/staging.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "production",
      tracesSampleRate: 0.2,
      ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "production",
      tracesSampleRate: 0.1,
    });
  }
}
