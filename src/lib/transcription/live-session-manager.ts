/**
 * Live Transcription Session Manager
 *
 * Server-side singleton managing active real-time transcription sessions.
 * Each session connects to AssemblyAI's streaming API and broadcasts
 * transcript turns to all subscribed WebSocket clients.
 */

import { WebSocket } from 'ws';
import {
  createRealtimeTranscriber,
  type RealtimeTranscriberHandle,
  type RealtimeTranscriptTurn,
} from './assemblyai';
import { saveTranscript } from './db';
import type { TranscriptionResult, TranscriptionSegment } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveSession {
  sessionId: string;
  campaignId: string;
  dmUserId: string;
  assemblyaiHandle: RealtimeTranscriberHandle;
  accumulatedSegments: TranscriptionSegment[];
  accumulatedText: string;
  subscribers: Set<WebSocket>;
  startedAt: Date;
  sampleRate: number;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class LiveSessionManager {
  private sessions = new Map<string, LiveSession>();

  /**
   * Start a new live transcription session.
   */
  async startLiveSession(params: {
    sessionId: string;
    campaignId: string;
    dmUserId: string;
    sampleRate?: number;
    wordBoost?: string[];
  }): Promise<void> {
    if (this.sessions.has(params.sessionId)) {
      throw new Error(`Live session already active for ${params.sessionId}`);
    }

    const sampleRate = params.sampleRate ?? 16000;

    const session: LiveSession = {
      sessionId: params.sessionId,
      campaignId: params.campaignId,
      dmUserId: params.dmUserId,
      assemblyaiHandle: null as any, // Set below
      accumulatedSegments: [],
      accumulatedText: '',
      subscribers: new Set(),
      startedAt: new Date(),
      sampleRate,
    };

    // Create AssemblyAI real-time transcriber
    const handle = createRealtimeTranscriber({
      sampleRate,
      wordBoost: params.wordBoost,

      onTranscript: (turn: RealtimeTranscriptTurn) => {
        // Accumulate final transcripts
        if (turn.isFinal && turn.text.trim()) {
          const segment: TranscriptionSegment = {
            start: session.accumulatedSegments.length > 0
              ? session.accumulatedSegments[session.accumulatedSegments.length - 1].end
              : 0,
            end: (Date.now() - session.startedAt.getTime()) / 1000,
            text: turn.text.trim(),
            speaker: turn.speaker,
          };
          session.accumulatedSegments.push(segment);
          session.accumulatedText += (session.accumulatedText ? ' ' : '') + turn.text.trim();
        }

        // Broadcast to all subscribers
        const message = JSON.stringify({
          type: 'live_transcript',
          sessionId: params.sessionId,
          turn: {
            text: turn.text,
            isFinal: turn.isFinal,
            speaker: turn.speaker,
            words: turn.words,
            timestamp: turn.timestamp,
          },
        });

        for (const ws of session.subscribers) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        }
      },

      onError: (error: Error) => {
        console.error(`[LiveSession ${params.sessionId}] Error:`, error.message);
        // Broadcast error to subscribers
        const message = JSON.stringify({
          type: 'live_session_error',
          sessionId: params.sessionId,
          error: error.message,
        });
        for (const ws of session.subscribers) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        }
      },

      onOpen: () => {
        console.log(`[LiveSession ${params.sessionId}] Connected to AssemblyAI`);
      },

      onClose: (code: number, reason: string) => {
        console.log(`[LiveSession ${params.sessionId}] Closed: ${code} ${reason}`);
      },
    });

    session.assemblyaiHandle = handle;
    this.sessions.set(params.sessionId, session);

    // Connect to AssemblyAI
    await handle.connect();

    // Notify subscribers that session started
    const startMsg = JSON.stringify({
      type: 'live_session_started',
      sessionId: params.sessionId,
    });
    for (const ws of session.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(startMsg);
      }
    }

    console.log(`[LiveSession ${params.sessionId}] Started`);
  }

  /**
   * Send audio data to a live session's AssemblyAI transcriber.
   */
  sendAudio(sessionId: string, chunk: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.assemblyaiHandle.sendAudio(chunk);
  }

  /**
   * Stop a live session, save accumulated transcript, and clean up.
   * Returns the transcript ID.
   */
  async stopLiveSession(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Close AssemblyAI connection (wait for any final transcripts)
    try {
      await session.assemblyaiHandle.close(true);
    } catch (err) {
      console.warn(`[LiveSession ${sessionId}] Error closing AssemblyAI:`, err);
    }

    let transcriptId: string | null = null;

    // Save accumulated transcript if we have content
    if (session.accumulatedText.trim()) {
      const duration = (Date.now() - session.startedAt.getTime()) / 1000;

      const result: TranscriptionResult = {
        success: true,
        text: session.accumulatedText,
        segments: session.accumulatedSegments,
        language: 'en',
        language_probability: 1,
        duration,
        hasSpeakers: session.accumulatedSegments.some((s) => !!s.speaker),
      };

      transcriptId = await saveTranscript({
        sessionId,
        result,
      });

      console.log(`[LiveSession ${sessionId}] Saved transcript: ${transcriptId}`);
    }

    // Notify subscribers that session ended
    const endMsg = JSON.stringify({
      type: 'live_session_ended',
      sessionId,
      transcriptId,
    });
    for (const ws of session.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(endMsg);
      }
    }

    // Cleanup
    this.sessions.delete(sessionId);
    console.log(`[LiveSession ${sessionId}] Stopped`);

    return transcriptId;
  }

  /**
   * Subscribe a WebSocket client to receive live transcription updates.
   */
  subscribeToSession(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.subscribers.add(ws);
    return true;
  }

  /**
   * Unsubscribe a WebSocket client from a session.
   */
  unsubscribeFromSession(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribers.delete(ws);
    }
  }

  /**
   * Remove a WebSocket client from all sessions (e.g., on disconnect).
   */
  removeClient(ws: WebSocket): void {
    for (const session of this.sessions.values()) {
      session.subscribers.delete(ws);
    }
  }

  /**
   * Check if a session has an active live transcription.
   */
  isSessionLive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get info about a live session.
   */
  getSessionInfo(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      subscriberCount: session.subscribers.size,
      segmentCount: session.accumulatedSegments.length,
      textLength: session.accumulatedText.length,
    };
  }
}

// Export singleton
export const liveSessionManager = new LiveSessionManager();
