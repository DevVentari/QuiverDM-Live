const QDM_BASE = 'https://quiverdm.com';

// Cross-browser API shim — Firefox uses browser.*, Chrome uses chrome.*
const ext = typeof browser !== 'undefined' ? browser : chrome;

// --- PKCE helpers ---

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

async function generateCodeChallenge(verifier) {
  const enc = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return base64url(hash);
}

// --- OAuth PKCE flow ---

async function launchOAuthFlow() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  const redirectUri = ext.identity.getRedirectURL('callback');

  const authorizeUrl = new URL(`${QDM_BASE}/api/auth/extension/authorize`);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  // browser.identity.launchWebAuthFlow returns a Promise; chrome.identity uses callback
  let responseUrl;
  if (typeof browser !== 'undefined') {
    responseUrl = await ext.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: true,
    });
  } else {
    responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authorizeUrl.toString(), interactive: true },
        (url) => {
          if (chrome.runtime.lastError || !url) {
            reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
          } else {
            resolve(url);
          }
        }
      );
    });
  }

  if (!responseUrl) throw new Error('Auth cancelled');

  const url = new URL(responseUrl);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('No auth code returned');

  // Exchange code for token
  const res = await fetch(`${QDM_BASE}/api/auth/extension/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error || 'No access token');

  await ext.storage.local.set({ qdm_token: data.access_token });
  return data.access_token;
}

ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    ext.storage.local.get('qdm_token').then((result) => {
      sendResponse({ token: result.qdm_token || null });
    });
    return true;
  }

  if (msg.type === 'LAUNCH_AUTH') {
    launchOAuthFlow()
      .then((token) => sendResponse({ token }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'LOGOUT') {
    ext.storage.local.remove('qdm_token').then(() => sendResponse({ ok: true }));
    return true;
  }
});
