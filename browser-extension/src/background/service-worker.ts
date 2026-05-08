import { authenticate, getValidAccessToken } from './auth';
import { QUIVERDM_TRPC_URL } from '../shared/config';
import type { MessageToServiceWorker, ImportResult, CampaignOption } from '../shared/types';

// ---------------------------------------------------------------------------
// Offscreen document management
// ---------------------------------------------------------------------------

let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  // Chrome 116+: precise check via getContexts
  if (chrome.runtime.getContexts) {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
      documentUrls: [offscreenUrl],
    });
    if (existing.length > 0) return;
  } else {
    // Fallback for older Chrome
    const contexts = await chrome.offscreen.getContexts?.() ?? [];
    if (contexts.some((c: { documentUrl: string }) => c.documentUrl?.includes('offscreen.html'))) return;
  }

  // Concurrency guard — prevent duplicate createDocument calls
  if (creating) {
    await creating;
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['BLOBS' as chrome.offscreen.Reason],
    justification: 'Maintain persistent WebSocket to QuiverDM session server',
  });

  try {
    await creating;
  } finally {
    creating = null;
  }
}

// Retry wrapper — handles rare race between createDocument resolving and
// the offscreen document's onMessage listener being ready
async function sendToOffscreen(message: object): Promise<void> {
  await ensureOffscreen();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await chrome.runtime.sendMessage(message);
      return;
    } catch (e) {
      if (attempt < 2 && String(e).includes('Receiving end')) {
        await new Promise<void>(r => setTimeout(r, 100 * (attempt + 1)));
      } else {
        // Swallow — offscreen may not be needed (e.g. WS feature unused)
        console.warn('[QuiverDM] offscreen send failed:', e);
        return;
      }
    }
  }
}

async function connectWs(): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) return;
  await sendToOffscreen({ type: 'offscreen.connect', token });
}

// ---------------------------------------------------------------------------
// tRPC import helper
// ---------------------------------------------------------------------------

async function trpcMutate(procedure: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/${procedure}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ json: input }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      return { ok: false, error: err.error?.message ?? 'Unknown error' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function fetchUserCampaigns(): Promise<CampaignOption[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/campaigns.getAll`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { result: { data: { json: CampaignOption[] } } };
    return data.result.data.json ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CobaltSession cookie helper
// ---------------------------------------------------------------------------

async function getCobaltCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.dndbeyond.com',
      name: 'CobaltSession',
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: MessageToServiceWorker, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // keep channel open for async response
  }
);

async function handleMessage(message: MessageToServiceWorker): Promise<ImportResult | CampaignOption[] | string | null | void> {
  if (message.type === 'import.monster') {
    return trpcMutate('npcs.createFromDDB', {
      campaignId: message.campaignId,
      monster: message.payload,
    });
  }

  if (message.type === 'import.character') {
    const cobalt = await getCobaltCookie();
    return trpcMutate('charactersDndBeyond.importCharacter', {
      characterId: message.ddbId,
      campaignId: message.campaignId,
      cobaltToken: cobalt ?? undefined,
    });
  }

  if (message.type === 'import.encounter') {
    return trpcMutate('encounterPlans.createFromDDB', {
      campaignId: message.campaignId,
      encounter: message.payload,
    });
  }

  if (message.type === 'live.event') {
    await sendToOffscreen({ type: 'offscreen.send', event: message.extMessage });
    return;
  }

  if (message.type === 'set.ddb.vtt.url') {
    return trpcMutate('foundry.setDdbVttUrl', {
      campaignId: message.campaignId,
      ddbVttUrl: message.url,
    });
  }

  if (message.type === 'get.campaigns') {
    return fetchUserCampaigns();
  }

  if (message.type === 'get.cobalt') {
    return getCobaltCookie();
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  const token = await getValidAccessToken();
  if (!token) {
    const ok = await authenticate();
    if (ok) await connectWs();
  } else {
    await connectWs();
  }
});

// Reconnect alarm (keepalive + reconnect after SW termination)
chrome.alarms.create('ws-keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'ws-keepalive') {
    await connectWs();
  }
});
