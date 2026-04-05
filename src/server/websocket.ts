import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';
import type { TranscriptionProgress } from '@/lib/transcription/progress';
import { prisma } from '@/lib/prisma';
import type {
  ExtIncomingMessage,
  ExtensionTokenPayload,
} from '@/lib/extension-types';

type LiveClientState = {
  sessionId: string;
  userId: string;
  campaignId: string;
  role: string;
};

type JoinLiveMessage = {
  type: 'join_live_session';
  sessionId: string;
  token: string;
  sampleRate?: number;
};

type StopLiveMessage = {
  type: 'stop_live';
  sessionId: string;
};

type SubscribeMessage = {
  type: 'subscribe' | 'unsubscribe';
  jobId: string;
};

type PlayerStateUpdateMessage = {
  type: 'player:state:update';
  sessionId: string;
  campaignId: string;
  userId: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: string[];
};

type DmSpotlightPushMessage = {
  type: 'dm:spotlight:push';
  sessionId: string;
  campaignId: string;
  spotlightType: string;
  content: unknown;
};

type DmSpotlightClearMessage = {
  type: 'dm:spotlight:clear';
  sessionId: string;
  campaignId: string;
};

type DmInitiativeUpdateMessage = {
  type: 'dm:initiative:update';
  sessionId: string;
  campaignId: string;
  participants: unknown[];
  currentTurnId: string | null;
  round: number;
};

type IncomingMessage =
  | JoinLiveMessage
  | StopLiveMessage
  | SubscribeMessage
  | PlayerStateUpdateMessage
  | DmSpotlightPushMessage
  | DmSpotlightClearMessage
  | DmInitiativeUpdateMessage
  | { type: 'ping' }
  | { type: 'ext.auth'; token: string };

type LiveSessionTokenPayload = {
  userId: string;
  sessionId: string;
  campaignId: string;
  sampleRate?: number;
};

type LiveSessionManager = {
  subscribeToSession: (sessionId: string, ws: WebSocket) => void;
  startLiveSession: (input: {
    sessionId: string;
    campaignId: string;
    dmUserId: string;
    sampleRate: number;
  }) => Promise<unknown>;
  sendAudio: (sessionId: string, audio: Buffer) => Promise<unknown> | unknown;
  removeClient: (ws: WebSocket) => void;
  stopLiveSession: (sessionId: string) => Promise<string | null | undefined>;
  isSessionLive: (sessionId: string) => boolean;
};

let wss: WebSocketServer | null = null;
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');
const jobSubscriptions = new Map<string, Set<WebSocket>>();
const liveClients = new Map<WebSocket, LiveClientState>();
const extClients = new Map<WebSocket, { userId: string; sessionId?: string }>();
const sessionClients = new Map<string, Set<WebSocket>>();
let liveSessionManagerPromise: Promise<LiveSessionManager | null> | null = null;

async function getLiveSessionManager(): Promise<LiveSessionManager | null> {
  if (!liveSessionManagerPromise) {
    liveSessionManagerPromise = (async () => {
      try {
        const modulePath = '@/lib/transcription/live-session-manager';
        const loaded = (await import(modulePath)) as { liveSessionManager?: LiveSessionManager };
        return loaded.liveSessionManager ?? null;
      } catch {
        return null;
      }
    })();
  }

  return liveSessionManagerPromise;
}

function sendJSON(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function parseJSONMessage(raw: WebSocket.RawData): IncomingMessage | null {
  if (Buffer.isBuffer(raw)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.toString()) as IncomingMessage;
    return parsed;
  } catch {
    return null;
  }
}

function addJobSubscription(ws: WebSocket, jobId: string) {
  if (!jobSubscriptions.has(jobId)) {
    jobSubscriptions.set(jobId, new Set());
  }
  jobSubscriptions.get(jobId)!.add(ws);
}

function removeJobSubscription(ws: WebSocket, jobId: string) {
  const subscribers = jobSubscriptions.get(jobId);
  if (!subscribers) {
    return;
  }

  subscribers.delete(ws);
  if (subscribers.size === 0) {
    jobSubscriptions.delete(jobId);
  }
}

function removeClientFromAllJobSubscriptions(ws: WebSocket) {
  for (const [jobId, subscribers] of jobSubscriptions.entries()) {
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      jobSubscriptions.delete(jobId);
    }
  }
}

function addSessionClient(ws: WebSocket, sessionId: string) {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);
}

function removeClientFromSession(ws: WebSocket, sessionId: string) {
  const clients = sessionClients.get(sessionId);
  if (!clients) {
    return;
  }
  clients.delete(ws);
  if (clients.size === 0) {
    sessionClients.delete(sessionId);
  }
}

function broadcastToSession(sessionId: string, payload: Record<string, unknown>, exclude?: WebSocket) {
  const clients = sessionClients.get(sessionId);
  if (!clients || clients.size === 0) {
    return;
  }

  const serialized = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function broadcastToJobSubscribers(jobId: string, payload: Record<string, unknown>) {
  const subscribers = jobSubscriptions.get(jobId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const serialized = JSON.stringify(payload);
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

async function handleJoinLiveSession(ws: WebSocket, message: JoinLiveMessage) {
  const { sessionId, token } = message;
  const tokenKey = `live-session-token:${token}`;

  try {
    const tokenValue = await redis.get(tokenKey);
    if (!tokenValue) {
      sendJSON(ws, {
        type: 'live_session_error',
        sessionId,
        error: 'Invalid or expired live session token',
      });
      ws.close(4001, 'Invalid token');
      return;
    }

    const payload = JSON.parse(tokenValue) as LiveSessionTokenPayload;
    if (payload.sessionId !== sessionId) {
      await redis.del(tokenKey);
      sendJSON(ws, {
        type: 'live_session_error',
        sessionId,
        error: 'Session mismatch for live session token',
      });
      ws.close(4002, 'Session mismatch');
      return;
    }

    await redis.del(tokenKey);

    const member = await prisma.campaignMember.findFirst({
      where: { userId: payload.userId, campaignId: payload.campaignId },
      select: { role: true },
    });

    const role = member?.role ?? 'PLAYER';

    liveClients.set(ws, {
      sessionId,
      userId: payload.userId,
      campaignId: payload.campaignId,
      role,
    });
    addSessionClient(ws, sessionId);

    if (role === 'PLAYER' || role === 'SPECTATOR') {
      sendJSON(ws, { type: 'live_session_joined', sessionId });
      return;
    }

    const manager = await getLiveSessionManager();
    if (!manager) {
      sendJSON(ws, {
        type: 'live_session_error',
        sessionId,
        error: 'Live transcription server is unavailable',
      });
      ws.close(1011, 'Live session manager unavailable');
      return;
    }

    manager.subscribeToSession(sessionId, ws);
    const isAlreadyLive = manager.isSessionLive(sessionId);

    if (!isAlreadyLive) {
      await manager.startLiveSession({
        sessionId,
        campaignId: payload.campaignId,
        dmUserId: payload.userId,
        sampleRate: message.sampleRate ?? payload.sampleRate ?? 16000,
      });
      sendJSON(ws, { type: 'live_session_started', sessionId });
    }
  } catch (error) {
    console.error('[WebSocket] Failed to join live session:', error);
    sendJSON(ws, {
      type: 'live_session_error',
      sessionId,
      error: 'Failed to start live transcription session',
    });
  }
}

async function handleStopLive(ws: WebSocket, message: StopLiveMessage) {
  const manager = await getLiveSessionManager();
  if (!manager) {
    sendJSON(ws, {
      type: 'live_session_error',
      sessionId: message.sessionId,
      error: 'Live transcription server is unavailable',
    });
    return;
  }

  try {
    const transcriptId = await manager.stopLiveSession(message.sessionId);
    sendJSON(ws, {
      type: 'live_session_ended',
      sessionId: message.sessionId,
      transcriptId: transcriptId ?? null,
    });
  } catch (error) {
    console.error('[WebSocket] Failed to stop live session:', error);
    sendJSON(ws, {
      type: 'live_session_error',
      sessionId: message.sessionId,
      error: 'Failed to stop live transcription session',
    });
  }
}

async function handleExtAuth(ws: WebSocket, token: string) {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  try {
    const { payload } = await jwtVerify(token, secret);
    const ext = payload as unknown as ExtensionTokenPayload;
    if (ext.type !== 'extension-access') {
      sendJSON(ws, { type: 'ext.auth.error', error: 'Wrong token type' });
      ws.close(4003, 'Wrong token type');
      return;
    }
    extClients.set(ws, { userId: ext.sub });
    sendJSON(ws, { type: 'ext.auth.ok', userId: ext.sub });
  } catch {
    sendJSON(ws, { type: 'ext.auth.error', error: 'Invalid or expired token' });
    ws.close(4001, 'Invalid token');
  }
}

function handleExtMessage(ws: WebSocket, message: ExtIncomingMessage) {
  const client = extClients.get(ws);
  if (!client) {
    sendJSON(ws, { type: 'error', message: 'Not authenticated as extension client' });
    return;
  }

  if (message.type === 'ext.character.update') {
    if (!client.sessionId) {
      client.sessionId = message.sessionId;
      extClients.set(ws, client);
    }
    broadcastToSession(message.sessionId, {
      type: 'session.party.update',
      sessionId: message.sessionId,
      source: 'extension',
      characterId: message.characterId,
      patch: message.patch,
    });
    return;
  }

  if (message.type === 'ext.roll') {
    broadcastToSession(message.sessionId, {
      type: 'session.roll.log',
      sessionId: message.sessionId,
      source: 'extension',
      characterId: message.characterId,
      roll: message.roll,
    });
    return;
  }

  if (message.type === 'ext.combat.start') {
    broadcastToSession(message.sessionId, {
      type: 'session.combat.update',
      sessionId: message.sessionId,
      source: 'extension',
      event: 'start',
      initiativeOrder: message.initiativeOrder,
    });
    return;
  }

  if (message.type === 'ext.combat.end') {
    broadcastToSession(message.sessionId, {
      type: 'session.combat.update',
      sessionId: message.sessionId,
      source: 'extension',
      event: 'end',
    });
    return;
  }

  if (message.type === 'ext.token.placed') {
    broadcastToSession(message.sessionId, {
      type: 'session.token.placed',
      sessionId: message.sessionId,
      source: 'extension',
      npcDdbId: message.npcDdbId,
      tokenData: message.tokenData,
    });
    return;
  }
}

async function handleSocketMessage(ws: WebSocket, raw: WebSocket.RawData) {
  if (Buffer.isBuffer(raw)) {
    const state = liveClients.get(ws);
    if (!state) {
      return;
    }

    const manager = await getLiveSessionManager();
    if (!manager) {
      return;
    }

    await manager.sendAudio(state.sessionId, raw);
    return;
  }

  const message = parseJSONMessage(raw);
  if (!message) {
    sendJSON(ws, { type: 'error', message: 'Invalid message format' });
    return;
  }

  if (message.type === 'subscribe') {
    addJobSubscription(ws, message.jobId);
    return;
  }

  if (message.type === 'unsubscribe') {
    removeJobSubscription(ws, message.jobId);
    return;
  }

  if (message.type === 'join_live_session') {
    await handleJoinLiveSession(ws, message);
    return;
  }

  if (message.type === 'stop_live') {
    await handleStopLive(ws, message);
    return;
  }

  if (message.type === 'player:state:update') {
    const clientState = liveClients.get(ws);
    if (!clientState) return;
    broadcastToSession(clientState.sessionId, {
      type: 'player:state:update',
      sessionId: clientState.sessionId,
      campaignId: clientState.campaignId,
      userId: clientState.userId,
      hp: message.hp,
      maxHp: message.maxHp,
      tempHp: message.tempHp,
      conditions: message.conditions,
    }, ws);
    return;
  }

  if (message.type === 'dm:spotlight:push') {
    const clientState = liveClients.get(ws);
    if (!clientState) return;
    if (clientState.role !== 'OWNER' && clientState.role !== 'CO_DM') return;
    broadcastToSession(clientState.sessionId, {
      type: 'dm:spotlight:push',
      sessionId: clientState.sessionId,
      campaignId: clientState.campaignId,
      spotlightType: message.spotlightType,
      content: message.content,
    });
    return;
  }

  if (message.type === 'dm:spotlight:clear') {
    const clientState = liveClients.get(ws);
    if (!clientState) return;
    if (clientState.role !== 'OWNER' && clientState.role !== 'CO_DM') return;
    broadcastToSession(clientState.sessionId, {
      type: 'dm:spotlight:clear',
      sessionId: clientState.sessionId,
      campaignId: clientState.campaignId,
    });
    return;
  }

  if (message.type === 'dm:initiative:update') {
    const clientState = liveClients.get(ws);
    if (!clientState) return;
    if (clientState.role !== 'OWNER' && clientState.role !== 'CO_DM') return;
    broadcastToSession(clientState.sessionId, {
      type: 'dm:initiative:update',
      sessionId: clientState.sessionId,
      campaignId: clientState.campaignId,
      participants: message.participants,
      currentTurnId: message.currentTurnId,
      round: message.round,
    });
    return;
  }

  // Extension client auth
  if (message.type === 'ext.auth') {
    await handleExtAuth(ws, (message as { type: 'ext.auth'; token: string }).token);
    return;
  }

  // Extension client events
  if (typeof message.type === 'string' && message.type.startsWith('ext.')) {
    handleExtMessage(ws, message as unknown as ExtIncomingMessage);
    return;
  }

  if (message.type === 'ping') {
    sendJSON(ws, { type: 'pong' });
  }
}

async function handleSocketClose(ws: WebSocket) {
  removeClientFromAllJobSubscriptions(ws);

  const state = liveClients.get(ws);
  if (state) {
    removeClientFromSession(ws, state.sessionId);
    liveClients.delete(ws);
  }

  extClients.delete(ws);

  const manager = await getLiveSessionManager();
  manager?.removeClient(ws);
}

export function initWebSocketServer(port: number): WebSocketServer {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ port });
  console.log(`[WebSocket] Server running on ws://localhost:${port}`);

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      await handleSocketMessage(ws, raw);
    });

    ws.on('close', async () => {
      await handleSocketClose(ws);
    });

    ws.on('error', async () => {
      await handleSocketClose(ws);
    });
  });

  return wss;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

export function broadcastToAll(message: string) {
  if (!wss) {
    return;
  }

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastTranscriptionProgress(jobId: string, progress: TranscriptionProgress) {
  broadcastToJobSubscribers(jobId, {
    type: 'progress',
    jobId,
    data: progress,
  });
}

export function broadcastPDFProgress(pdfId: string, progress: number) {
  broadcastToJobSubscribers(pdfId, {
    type: 'pdf_progress',
    jobId: pdfId,
    progress,
    timestamp: Date.now(),
  });
}

export function broadcastPDFStatus(pdfId: string, status: string, data?: unknown) {
  broadcastToJobSubscribers(pdfId, {
    type: 'pdf_status',
    jobId: pdfId,
    status,
    data,
    timestamp: Date.now(),
  });
}

export function broadcastMultiTrackProgress(
  uploadGroupId: string,
  payload: { recordingId: string; completed: number; total: number; stage: string }
) {
  broadcastToJobSubscribers(uploadGroupId, {
    type: 'multitrack:track_complete',
    uploadGroupId,
    ...payload,
  });
}

export function broadcastMultiTrackComplete(
  uploadGroupId: string,
  transcriptId: string
) {
  broadcastToJobSubscribers(uploadGroupId, {
    type: 'multitrack:complete',
    uploadGroupId,
    transcriptId,
  });
}

export function broadcastMultiTrackError(
  uploadGroupId: string,
  error: string,
  recordingId?: string
) {
  broadcastToJobSubscribers(uploadGroupId, {
    type: 'multitrack:error',
    uploadGroupId,
    recordingId,
    error,
  });
}

export function broadcastRecapComplete(sessionId: string, recapId: string) {
  broadcastToJobSubscribers(sessionId, {
    type: 'recap:complete',
    sessionId,
    recapId,
  });
}
