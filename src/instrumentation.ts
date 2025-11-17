/**
 * Next.js instrumentation file for initializing long-running processes
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize WebSocket server
    const { initWebSocketServer } = await import('./server/websocket');

    const port = parseInt(process.env.WS_PORT || '3004', 10);
    initWebSocketServer(port);

    console.log(`[Instrumentation] WebSocket server initialized on port ${port}`);

    // Start PDF processing worker
    try {
      const { startPDFWorker } = await import('./lib/queue-worker');
      const concurrency = parseInt(process.env.PDF_WORKER_CONCURRENCY || '2', 10);
      startPDFWorker(concurrency);
      console.log(`[Instrumentation] PDF processing worker started with concurrency: ${concurrency}`);
    } catch (error) {
      console.error('[Instrumentation] Failed to start PDF worker:', error);
    }
  }
}
