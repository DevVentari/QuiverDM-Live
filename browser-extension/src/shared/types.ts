// browser-extension/src/shared/types.ts
// Internal message types passed between extension worlds via chrome.runtime.sendMessage

export type MessageToServiceWorker =
  | { type: 'import.monster'; payload: import('./extension-types').DdbMonsterImportPayload; campaignId: string }
  | { type: 'import.character'; ddbId: string; campaignId: string }
  | { type: 'import.spell'; payload: Record<string, unknown>; campaignId: string }
  | { type: 'import.item'; payload: Record<string, unknown>; campaignId: string }
  | { type: 'import.encounter'; payload: import('./extension-types').DdbEncounterImportPayload; campaignId: string }
  | { type: 'live.event'; extMessage: import('./extension-types').ExtIncomingMessage }
  | { type: 'network.intercept'; url: string; body: unknown }
  | { type: 'set.ddb.vtt.url'; campaignId: string; url: string }
  | { type: 'get.campaigns' }
  | { type: 'get.cobalt' };

export interface ImportResult {
  ok: boolean;
  error?: string;
  name?: string;
}

export interface CampaignOption {
  id: string;
  name: string;
  slug: string;
}
