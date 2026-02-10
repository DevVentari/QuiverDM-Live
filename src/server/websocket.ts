import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import type { TranscriptionProgress } from '@/lib/transcription/progress';

interface ClientSubscription {
  ws: WebSocket;
  jobId: string;
}

class TranscriptionProgressWebSocketServer {
  private wss: WebSocketServer;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  constructor(port: number = 3004) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      console.log('WebSocket client connected');

      // Parse URL to get job ID from query params
      const { query } = parse(request.url || '', true);
      const jobId = query.jobId as string;

      if (jobId) {
        this.subscribe(ws, jobId);
        console.log(`Client subscribed to job: ${jobId}`);
      }

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'subscribe' && data.jobId) {
            this.subscribe(ws, data.jobId);
            console.log(`Client subscribed to job: ${data.jobId}`);
          } else if (data.type === 'unsubscribe' && data.jobId) {
            this.unsubscribe(ws, data.jobId);
            console.log(`Client unsubscribed from job: ${data.jobId}`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });
    });

    console.log(`WebSocket server running on ws://localhost:${port}`);
  }

  /**
   * Subscribe a WebSocket client to progress updates for a specific job
   */
  private subscribe(ws: WebSocket, jobId: string) {
    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, new Set());
    }
    this.subscriptions.get(jobId)!.add(ws);
  }

  /**
   * Unsubscribe a WebSocket client from a specific job
   */
  private unsubscribe(ws: WebSocket, jobId: string) {
    const subscribers = this.subscriptions.get(jobId);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(jobId);
      }
    }
  }

  /**
   * Remove a client from all subscriptions
   */
  private removeClient(ws: WebSocket) {
    for (const [jobId, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(jobId);
      }
    }
  }

  /**
   * Broadcast progress update to all clients subscribed to a specific job
   */
  public broadcastProgress(jobId: string, progress: TranscriptionProgress | any) {
    const subscribers = this.subscriptions.get(jobId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'progress',
      jobId,
      data: progress,
    });

    // Send to all subscribers
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }

    console.log(`Broadcasted progress for job ${jobId} to ${subscribers.size} client(s)`);
  }

  /**
   * Broadcast generic message to all clients subscribed to a specific job
   */
  public broadcastMessage(jobId: string, message: any) {
    const subscribers = this.subscriptions.get(jobId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const messageStr = JSON.stringify({
      ...message,
      jobId,
      timestamp: Date.now(),
    });

    // Send to all subscribers
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }

    console.log(`Broadcasted message for job ${jobId} to ${subscribers.size} client(s)`);
  }

  /**
   * Close the WebSocket server
   */
  public close() {
    this.wss.close();
  }
}

// Singleton instance
let wsServer: TranscriptionProgressWebSocketServer | null = null;

/**
 * Initialize the WebSocket server
 */
export function initWebSocketServer(port: number = 3004): TranscriptionProgressWebSocketServer {
  if (!wsServer) {
    wsServer = new TranscriptionProgressWebSocketServer(port);
  }
  return wsServer;
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): TranscriptionProgressWebSocketServer | null {
  return wsServer;
}

/**
 * Broadcast progress update to subscribed clients
 */
export function broadcastTranscriptionProgress(jobId: string, progress: TranscriptionProgress) {
  if (wsServer) {
    wsServer.broadcastProgress(jobId, progress);
  }
}

/**
 * Broadcast PDF processing progress to subscribed clients
 */
export function broadcastPDFProgress(pdfId: string, progress: number) {
  if (wsServer) {
    wsServer.broadcastMessage(pdfId, {
      type: 'pdf_progress',
      progress,
    });
  }
}

/**
 * Broadcast PDF processing status to subscribed clients
 */
export function broadcastPDFStatus(pdfId: string, status: string, data?: any) {
  if (wsServer) {
    wsServer.broadcastMessage(pdfId, {
      type: 'pdf_status',
      status,
      data,
    });
  }
}
