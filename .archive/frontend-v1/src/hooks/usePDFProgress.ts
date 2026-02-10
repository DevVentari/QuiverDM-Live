/**
 * React Hook for Real-time PDF Processing Progress
 *
 * Connects to WebSocket server and subscribes to PDF processing updates
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface PDFProgressUpdate {
  type: 'progress' | 'active' | 'waiting' | 'completed' | 'failed' | 'status' | 'pdf_progress' | 'pdf_status' | 'pdf_stage_detail';
  pdfId?: string;
  jobId?: string; // Some messages use jobId
  progress?: number;
  status?: string;
  error?: string;
  result?: any;
  data?: {
    progress?: number;
    status?: string;
    stageProgress?: number;
    detail?: string;
    currentPage?: number;
    totalPages?: number;
  };
  timestamp: number;
}

export interface UsePDFProgressOptions {
  pdfId: string;
  userId?: string;
  enabled?: boolean;
  onProgress?: (progress: number) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
}

export function usePDFProgress({
  pdfId,
  userId,
  enabled = true,
  onProgress,
  onComplete,
  onError,
  onStatusChange,
}: UsePDFProgressOptions) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [lastUpdate, setLastUpdate] = useState<PDFProgressUpdate | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Store callbacks in refs to avoid causing reconnections on callback changes
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);

  // Update refs when callbacks change
  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    onStatusChangeRef.current = onStatusChange;
  }, [onProgress, onComplete, onError, onStatusChange]);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    // Determine WebSocket URL - connects to standalone WebSocket server on port 3004
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3004';
    const wsUrl = `${protocol}//${hostname}:${wsPort}`;

    console.log(`[usePDFProgress] Connecting to ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[usePDFProgress] Connected');
        setStatus('connected');
        reconnectAttempts.current = 0;

        // Authenticate if userId provided
        if (userId) {
          ws.send(JSON.stringify({ type: 'auth', userId }));
        }

        // Subscribe to PDF updates
        ws.send(JSON.stringify({ type: 'subscribe', pdfId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PDFProgressUpdate;

          // Check if this message is for our PDF (can be pdfId or jobId)
          const messageId = data.pdfId || data.jobId;
          if (messageId && messageId !== pdfId) {
            // Ignore messages for other PDFs
            return;
          }

          setLastUpdate(data);

          switch (data.type) {
            case 'progress':
              if (data.progress !== undefined) {
                setProgress(data.progress);
                onProgressRef.current?.(data.progress);
              }
              break;

            case 'pdf_progress':
              // Handle progress from WebSocket server (data.data.progress)
              const progressValue = data.data?.progress ?? data.progress;
              if (progressValue !== undefined) {
                setProgress(progressValue);
                onProgressRef.current?.(progressValue);
              }
              break;

            case 'pdf_status':
            case 'pdf_stage_detail':
              // Handle status updates from WebSocket server
              const statusValue = data.data?.status ?? data.status;
              if (statusValue) {
                onStatusChangeRef.current?.(statusValue);
              }
              // Also update progress if provided in data
              if (data.data?.progress !== undefined) {
                setProgress(data.data.progress);
                onProgressRef.current?.(data.data.progress);
              }
              break;

            case 'completed':
              setProgress(100);
              onCompleteRef.current?.(data.result);
              break;

            case 'failed':
              onErrorRef.current?.(data.error || 'Processing failed');
              break;

            case 'status':
              onStatusChangeRef.current?.(data.status || 'unknown');
              break;

            case 'active':
              onStatusChangeRef.current?.('processing');
              break;

            case 'waiting':
              onStatusChangeRef.current?.('waiting');
              break;
          }
        } catch (error) {
          console.error('[usePDFProgress] Error parsing message:', error);
        }
      };

      ws.onerror = () => {
        // WebSocket errors are common during development (connection refused, etc.)
        // Don't spam console with error objects - they're not informative
        console.warn('[usePDFProgress] WebSocket connection error - will retry');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('[usePDFProgress] Disconnected');
        setStatus('idle');
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;

          console.log(
            `[usePDFProgress] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('[usePDFProgress] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[usePDFProgress] Error creating WebSocket:', error);
      setStatus('error');
    }
  }, [enabled, pdfId, userId]); // Removed callback dependencies - they're in refs now

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Unsubscribe before disconnecting
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', pdfId }));
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('idle');
  }, [pdfId]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Reconnect if pdfId changes
  useEffect(() => {
    if (enabled && wsRef.current?.readyState === WebSocket.OPEN) {
      // Unsubscribe from old pdfId
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', pdfId }));
      // Subscribe to new pdfId
      wsRef.current.send(JSON.stringify({ type: 'subscribe', pdfId }));
    }
  }, [pdfId, enabled]);

  return {
    progress,
    status,
    lastUpdate,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
    connect,
    disconnect,
  };
}
