// browser-extension/src/background/auth.ts
import { QUIVERDM_BASE_URL, QUIVERDM_TRPC_URL } from '../shared/config';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

const STORAGE_KEY = 'quiverdm_tokens';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(Array.from(array, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(Array.from(new Uint8Array(digest), b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export async function getTokens(): Promise<StoredTokens | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredTokens) ?? null;
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Get valid access token (refresh if needed)
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  // Refresh 5 min before expiry
  if (Date.now() < tokens.expiresAt - 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(tokens.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/extensionAuth.refreshExtensionToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { refreshToken } }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json() as {
      result: { data: { json: { accessToken: string; expiresIn?: number } } }
    };
    const { accessToken, expiresIn } = data.result.data.json;

    const stored = await getTokens();
    if (stored) {
      await saveTokens({
        ...stored,
        accessToken,
        expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
      });
    }

    return accessToken;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth PKCE flow
// ---------------------------------------------------------------------------

export async function authenticate(): Promise<boolean> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  // chrome.identity.getRedirectURL() returns a https://<id>.chromiumapp.org/ URL.
  // The server validates redirect_uri starts with 'chrome-extension://' OR contains 'chromiumapp.org'.
  const redirectUri = chrome.identity.getRedirectURL('auth-callback');

  const authorizeUrl = new URL(`${QUIVERDM_BASE_URL}/api/auth/extension/authorize`);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  let callbackUrl: string | undefined;
  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: true,
    });
  } catch {
    return false;
  }

  if (!callbackUrl) return false;

  const params = new URL(callbackUrl).searchParams;
  const code = params.get('code');
  if (!code) return false;

  // Exchange code for tokens
  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/extensionAuth.exchangeExtensionCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { code, codeVerifier: verifier } }),
    });

    if (!res.ok) return false;

    const data = await res.json() as {
      result: { data: { json: { accessToken: string; refreshToken: string; expiresIn?: number } } }
    };
    const { accessToken, refreshToken, expiresIn } = data.result.data.json;

    await saveTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
    });

    return true;
  } catch {
    return false;
  }
}
