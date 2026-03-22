const QDM_BASE = 'https://quiverdm.com';

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

  const redirectUri = chrome.identity.getRedirectURL('callback');

  const authorizeUrl = new URL(`${QDM_BASE}/api/auth/extension/authorize`);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authorizeUrl.toString(), interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
          return;
        }

        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        if (!code) {
          reject(new Error('No auth code returned'));
          return;
        }

        // Exchange code for token
        try {
          const res = await fetch(`${QDM_BASE}/api/auth/extension/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, code_verifier: verifier }),
          });
          const data = await res.json();
          if (!data.access_token) throw new Error('No access token');
          await chrome.storage.local.set({ qdm_token: data.access_token });
          resolve(data.access_token);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    chrome.storage.local.get('qdm_token', (result) => {
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
    chrome.storage.local.remove('qdm_token', () => sendResponse({ ok: true }));
    return true;
  }
});
