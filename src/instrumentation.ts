/**
 * Next.js instrumentation file
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * PDF worker runs as a standalone process via `npm run worker:pdf`.
 * WebSocket server runs via `npm run dev:ws`.
 * Neither should be started here — Next.js dev HMR re-evaluates this module
 * repeatedly, which creates duplicate workers and WS servers.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Next.js server runtime initialized');

    const shouldInitSearch =
      process.env.ENABLE_SEARCH_STARTUP_INIT === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.ENABLE_SEARCH_STARTUP_INIT !== 'false');

    if (!shouldInitSearch) {
      console.log('[Instrumentation] Skipping MeiliSearch startup init');
      return;
    }

    // Configure MeiliSearch index settings on startup (idempotent).
    // Safe to run every cold start — only updates settings, never destroys data.
    const { initSearchIndexes } = await import('./lib/search');
    initSearchIndexes().catch((err) =>
      console.warn('[Instrumentation] MeiliSearch index init failed:', err)
    );
  }
}
