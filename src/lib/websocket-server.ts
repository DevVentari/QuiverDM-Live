/**
 * WebSocket Server for Real-time PDF Processing Updates
 *
 * Provides live progress updates to connected clients during PDF processing
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { pdfProcessingQueueEvents } from './queue';

interface WebSocketClient extends WebSocket {
  userId?: string;
  subscribedPdfIds?: Set<string>;
}

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(server: HTTPServer) {
  if (wss) {
    console.log('[WebSocket] Server already initialized');
    return wss;
  }

  wss = new WebSocketServer({
    server,
    path: '/api/ws/pdf-progress',
  });

  console.log('[WebSocket] Server initialized on path: /api/ws/pdf-progress');

  // Connection handler
  wss.on('connection', (ws: WebSocketClient, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WebSocket] Client connected from ${ip}`);

    ws.subscribedPdfIds = new Set();

    // Message handler
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'auth':
            // Store user ID for authorization
            ws.userId = data.userId;
            ws.send(JSON.stringify({ type: 'auth_success', userId: data.userId }));
            console.log(`[WebSocket] Client authenticated: ${data.userId}`);
            break;

          case 'subscribe':
            // Subscribe to PDF progress updates
            if (!ws.subscribedPdfIds) ws.subscribedPdfIds = new Set();
            ws.subscribedPdfIds.add(data.pdfId);
            ws.send(JSON.stringify({ type: 'subscribed', pdfId: data.pdfId }));
            console.log(`[WebSocket] Client subscribed to PDF: ${data.pdfId}`);
            break;

          case 'unsubscribe':
            // Unsubscribe from PDF updates
            ws.subscribedPdfIds?.delete(data.pdfId);
            ws.send(JSON.stringify({ type: 'unsubscribed', pdfId: data.pdfId }));
            console.log(`[WebSocket] Client unsubscribed from PDF: ${data.pdfId}`);
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            console.warn(`[WebSocket] Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    // Error handler
    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
    });

    // Close handler
    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected (userId: ${ws.userId})`);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        message: 'Connected to PDF processing updates',
      })
    );
  });

  // Listen to queue events and broadcast to clients
  setupQueueEventListeners();

  return wss;
}

/**
 * Setup listeners for queue events
 */
function setupQueueEventListeners() {
  // Job progress updates
  pdfProcessingQueueEvents.on('progress', ({ jobId, data }: { jobId: string; data: number }) => {
    broadcastToSubscribers(jobId, {
      type: 'progress',
      pdfId: jobId,
      progress: data,
      timestamp: Date.now(),
    });
  });

  // Job completed
  pdfProcessingQueueEvents.on('completed', ({ jobId, returnvalue }: { jobId: string; returnvalue: any }) => {
    broadcastToSubscribers(jobId, {
      type: 'completed',
      pdfId: jobId,
      result: returnvalue,
      timestamp: Date.now(),
    });
  });

  // Job failed
  pdfProcessingQueueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    broadcastToSubscribers(jobId, {
      type: 'failed',
      pdfId: jobId,
      error: failedReason,
      timestamp: Date.now(),
    });
  });

  // Job active (started processing)
  pdfProcessingQueueEvents.on('active', ({ jobId }: { jobId: string }) => {
    broadcastToSubscribers(jobId, {
      type: 'active',
      pdfId: jobId,
      timestamp: Date.now(),
    });
  });

  // Job waiting (queued)
  pdfProcessingQueueEvents.on('waiting', ({ jobId }: { jobId: string }) => {
    broadcastToSubscribers(jobId, {
      type: 'waiting',
      pdfId: jobId,
      timestamp: Date.now(),
    });
  });

  console.log('[WebSocket] Queue event listeners registered');
}

/**
 * Broadcast message to all clients subscribed to a specific PDF
 */
function broadcastToSubscribers(pdfId: string, message: any) {
  if (!wss) return;

  let sentCount = 0;

  wss.clients.forEach((client: WebSocket) => {
    const wsClient = client as WebSocketClient;

    if (
      wsClient.readyState === WebSocket.OPEN &&
      wsClient.subscribedPdfIds?.has(pdfId)
    ) {
      wsClient.send(JSON.stringify(message));
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(`[WebSocket] Broadcast ${message.type} for PDF ${pdfId} to ${sentCount} client(s)`);
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(message: any) {
  if (!wss) return;

  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      sentCount++;
    }
  });

  console.log(`[WebSocket] Broadcast to ${sentCount} client(s)`);
}

/**
 * Get number of connected clients
 */
export function getConnectedClients(): number {
  return wss?.clients.size || 0;
}

/**
 * Close WebSocket server
 */
export function closeWebSocketServer() {
  if (wss) {
    wss.close(() => {
      console.log('[WebSocket] Server closed');
    });
    wss = null;
  }
}

/**
 * Send progress update for a specific PDF
 */
export function sendPDFProgress(pdfId: string, progress: number) {
  broadcastToSubscribers(pdfId, {
    type: 'progress',
    pdfId,
    progress,
    timestamp: Date.now(),
  });
}

/**
 * Send status update for a specific PDF
 */
export function sendPDFStatus(pdfId: string, status: string, data?: any) {
  broadcastToSubscribers(pdfId, {
    type: 'status',
    pdfId,
    status,
    data,
    timestamp: Date.now(),
  });
}
