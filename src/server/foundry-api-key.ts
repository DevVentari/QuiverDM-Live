import { randomBytes } from 'crypto';

const API_KEY_PREFIX = 'qdmf';

export function createFoundryApiKey(campaignId: string): string {
  const secret = randomBytes(24).toString('base64url');
  return `${API_KEY_PREFIX}_${campaignId}_${secret}`;
}

export function parseCampaignIdFromFoundryApiKey(rawKey: string): string | null {
  if (!rawKey.startsWith(`${API_KEY_PREFIX}_`)) {
    return null;
  }

  const parts = rawKey.split('_');
  if (parts.length < 3) {
    return null;
  }

  return parts[1] || null;
}
