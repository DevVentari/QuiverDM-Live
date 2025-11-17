import { useEffect, useState, useRef } from 'react';
import type { TranscriptionProgress } from '@/lib/transcription-progress';
import { trpc } from '@/lib/trpc';

interface UseTranscriptionProgressOptions {
  jobId: string;
  enabled?: boolean;
  wsUrl?: string;
}

/**
 * Custom hook to connect to WebSocket and receive real-time transcription progress updates
 * Only connects for active jobs (processing/queued status)
 */
export function useTranscriptionProgress({
  jobId,
  enabled = true,
  wsUrl = 'ws://localhost:3004',
}: UseTranscriptionProgressOptions) {
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldConnectRef = useRef<boolean>(true);

  // Fetch initial job status to determine if we should connect
  const { data: initialProgress } = trpc.sessionTranscription.getTranscriptionProgress.useQuery(
    { jobId },
    {
      enabled: enabled && !!jobId,
      refetchInterval: false,
    }
  );

  useEffect(() => {
    if (!enabled || !jobId) {
      return;
    }

    // Check if job exists and is in an inactive state
    if (initialProgress) {
      setProgress(initialProgress);

      // Don't connect to WebSocket if job is completed or failed
      if (initialProgress.status === 'completed' || initialProgress.status === 'failed') {
        shouldConnectRef.current = false;
        return;
      }
    }

    // Connect for active jobs or when job status is still loading
    // (allows connection during job creation race condition)
    shouldConnectRef.current = true;

    let isMounted = true;

    const connect = () => {
      if (!shouldConnectRef.current) {
        return;
      }
      try {
        // Close existing connection if any
        if (wsRef.current) {
          wsRef.current.close();
        }

        // Create WebSocket connection with job ID in query params
        const ws = new WebSocket(`${wsUrl}?jobId=${jobId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) {
            console.log('[WS] Connected to transcription progress server');
            setIsConnected(true);
            setError(null);

            // Subscribe to job updates
            ws.send(
              JSON.stringify({
                type: 'subscribe',
                jobId,
              })
            );
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;

          try {
            const message = JSON.parse(event.data);

            if (message.type === 'progress' && message.jobId === jobId) {
              const updatedProgress = message.data as TranscriptionProgress;
              setProgress(updatedProgress);

              // Stop reconnecting if job is completed or failed
              if (updatedProgress.status === 'completed' || updatedProgress.status === 'failed') {
                shouldConnectRef.current = false;
              }
            }
          } catch (err) {
            console.error('[WS] Error parsing message:', err);
          }
        };

        ws.onerror = (event) => {
          // Suppress expected "close before connection" errors
          // These happen when connecting to completed/non-existent jobs
          if (isMounted && shouldConnectRef.current) {
            console.error('[WS] WebSocket error:', event);
            setError(new Error('WebSocket connection error'));
          }
        };

        ws.onclose = (event) => {
          if (isMounted) {
            setIsConnected(false);

            // Only attempt reconnect if job should still be active
            if (shouldConnectRef.current) {
              console.log('[WS] Disconnected from transcription progress server');

              // Attempt to reconnect after 3 seconds
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMounted && shouldConnectRef.current) {
                  console.log('[WS] Attempting to reconnect...');
                  connect();
                }
              }, 3000);
            }
          }
        };
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [jobId, enabled, wsUrl, initialProgress]);

  return {
    progress,
    isConnected,
    error,
  };
}
