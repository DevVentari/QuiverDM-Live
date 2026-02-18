/**
 * Standalone WebSocket Server for Transcription
 *
 * Run with: npm run dev:ws
 *
 * Handles:
 * - Transcription job progress broadcasting
 * - Live transcription audio streaming + real-time results
 * - PDF processing progress updates
 */

import 'dotenv/config';
import { initWebSocketServer } from './websocket';

const port = parseInt(process.env.WS_PORT || '3004', 10);

const server = initWebSocketServer(port);

process.on('SIGTERM', () => {
  console.log('[WS] SIGTERM received, shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WS] SIGINT received, shutting down...');
  server.close();
  process.exit(0);
});
