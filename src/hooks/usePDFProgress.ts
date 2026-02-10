'use client';

import { useEffect, useState, useRef } from 'react';

export interface PDFProgressDetails {
  stageProgress?: number;
  detail?: string;
  currentPage?: number;
  totalPages?: number;
  itemsFound?: {
    spells?: number;
    items?: number;
    creatures?: number;
    races?: number;
    classes?: number;
    feats?: number;
  };
}

export interface PDFProgressState {
  progress: number;
  status: string;
  details: PDFProgressDetails;
  isConnected: boolean;
  error: string | null;
}

/**
 * Custom hook to subscribe to real-time PDF processing progress via WebSocket
 *
 * @param pdfId - The ID of the PDF being processed
 * @returns Current progress state with percentage, status, and details
 */
export function usePDFProgress(pdfId: string | null | undefined): PDFProgressState {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('initializing');
  const [details, setDetails] = useState<PDFProgressDetails>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!pdfId) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3004';
    console.log('[usePDFProgress] Attempting to connect to:', wsUrl);
    console.log('[usePDFProgress] Environment NEXT_PUBLIC_WS_URL:', process.env.NEXT_PUBLIC_WS_URL);

    function connect() {
      try {
        console.log('[usePDFProgress] Creating WebSocket connection...');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[usePDFProgress] ✅ WebSocket connected to', wsUrl);
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;

          // Subscribe to this PDF's progress updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            jobId: pdfId
          }));
          console.log('[usePDFProgress] 📡 Subscribed to PDF:', pdfId);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Only process messages for this PDF
            if (data.jobId !== pdfId) {
              return;
            }

            // Update progress percentage
            if (data.type === 'pdf_progress' && typeof data.progress === 'number') {
              setProgress(Math.min(100, Math.max(0, data.progress)));
            }

            // Update status and details
            if (data.type === 'pdf_status') {
              if (data.status) {
                setStatus(data.status);
              }
              if (data.data) {
                setDetails(prev => ({ ...prev, ...data.data }));
              }
            }
          } catch (err) {
            console.error('[usePDFProgress] Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[usePDFProgress] WebSocket connection error:', {
            readyState: ws.readyState,
            url: wsUrl,
            error: error
          });
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[usePDFProgress] WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = null;

          // Auto-reconnect with exponential backoff (max 5 attempts)
          if (reconnectAttemptsRef.current < 5) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            reconnectAttemptsRef.current += 1;

            console.log(`[usePDFProgress] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/5)`);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            setError('Failed to connect after 5 attempts');
          }
        };
      } catch (err) {
        console.error('[usePDFProgress] Failed to create WebSocket:', err);
        setError('Failed to connect');
      }
    }

    // Initial connection
    connect();

    // Cleanup on unmount or pdfId change
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [pdfId]);

  return {
    progress,
    status,
    details,
    isConnected,
    error,
  };
}
