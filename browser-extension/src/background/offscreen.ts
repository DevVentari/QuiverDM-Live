// browser-extension/src/background/offscreen.ts
// Runs as an offscreen document — holds the persistent WS connection.
import { QUIVERDM_WS_URL } from '../shared/config';
import type { ExtIncomingMessage } from '../shared/extension-types';

let ws: WebSocket | null = null;
let pendingEvents: ExtIncomingMessage[] = [];
let authenticated = false;

function connect(token: string) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(QUIVERDM_WS_URL);

  ws.onopen = () => {
    ws!.send(JSON.stringify({ type: 'ext.auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { type: string };
      if (msg.type === 'ext.auth.ok') {
        authenticated = true;
        for (const e of pendingEvents) {
          ws!.send(JSON.stringify(e));
        }
        pendingEvents = [];
      }
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    authenticated = false;
    ws = null;
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function sendLiveEvent(event: ExtIncomingMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !authenticated) {
    pendingEvents.push(event);
    return;
  }
  ws.send(JSON.stringify(event));
}

chrome.runtime.onMessage.addListener((message: { type: string; token?: string; event?: ExtIncomingMessage }) => {
  if (message.type === 'offscreen.connect' && message.token) {
    connect(message.token);
    return;
  }
  if (message.type === 'offscreen.send' && message.event) {
    sendLiveEvent(message.event);
    return;
  }
  if (message.type === 'offscreen.disconnect') {
    ws?.close();
    ws = null;
    authenticated = false;
    pendingEvents = [];
    return;
  }
});
