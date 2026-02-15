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
  }
}
