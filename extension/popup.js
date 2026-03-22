const QDM_BASE = 'https://quiverdm.com';
const ext = typeof browser !== 'undefined' ? browser : chrome;

const authDot = document.getElementById('auth-dot');
const authLabel = document.getElementById('auth-label');
const cookieStatus = document.getElementById('cookie-status');
const cookieDot = document.getElementById('cookie-dot');
const cookieLabel = document.getElementById('cookie-label');
const primaryBtn = document.getElementById('primary-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMsg = document.getElementById('error-msg');
const successMsg = document.getElementById('success-msg');

let currentToken = null;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  successMsg.style.display = 'none';
}

function showSuccess(msg) {
  successMsg.textContent = msg;
  successMsg.style.display = 'block';
  errorMsg.style.display = 'none';
}

function clearMessages() {
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';
}

async function getCobaltCookie() {
  const cookie = await ext.cookies.get({ url: 'https://www.dndbeyond.com', name: 'CobaltSession' });
  return cookie ? cookie.value : null;
}

async function sendCookieToQdm(token, cobaltSession) {
  const res = await fetch(`${QDM_BASE}/api/integrations/cobalt-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ cobaltSession }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function init() {
  const result = await ext.storage.local.get('qdm_token');
  currentToken = result.qdm_token || null;

  if (!currentToken) {
    authDot.className = 'dot dot-amber';
    authLabel.textContent = 'Not connected to QuiverDM';
    cookieStatus.style.display = 'none';
    logoutBtn.style.display = 'none';
    primaryBtn.textContent = 'Connect to QuiverDM';
    primaryBtn.disabled = false;
    primaryBtn.onclick = handleConnect;
    return;
  }

  authDot.className = 'dot dot-green';
  authLabel.textContent = 'Connected to QuiverDM';
  logoutBtn.style.display = 'block';
  logoutBtn.onclick = handleLogout;

  cookieStatus.style.display = 'flex';
  const cookie = await getCobaltCookie();

  if (!cookie) {
    cookieDot.className = 'dot dot-red';
    cookieLabel.textContent = 'No CobaltSession — log in to D&D Beyond first';
    primaryBtn.textContent = 'Sync Cookie';
    primaryBtn.disabled = true;
    return;
  }

  cookieDot.className = 'dot dot-green';
  cookieLabel.textContent = 'CobaltSession found';
  primaryBtn.textContent = 'Sync to QuiverDM';
  primaryBtn.disabled = false;
  primaryBtn.onclick = () => handleSync(cookie);
}

async function handleConnect() {
  primaryBtn.disabled = true;
  primaryBtn.textContent = 'Connecting...';
  clearMessages();

  const response = await ext.runtime.sendMessage({ type: 'LAUNCH_AUTH' });
  if (response.error) {
    showError(response.error);
    primaryBtn.disabled = false;
    primaryBtn.textContent = 'Connect to QuiverDM';
    return;
  }

  currentToken = response.token;
  await init();
}

async function handleSync(cookie) {
  primaryBtn.disabled = true;
  primaryBtn.textContent = 'Syncing...';
  clearMessages();

  try {
    await sendCookieToQdm(currentToken, cookie);
    showSuccess('Cookie synced to QuiverDM!');
    primaryBtn.textContent = 'Sync to QuiverDM';
    primaryBtn.disabled = false;
  } catch (err) {
    if (err.message === 'unauthorized') {
      await ext.storage.local.remove('qdm_token');
      currentToken = null;
      await init();
    } else {
      showError(err.message);
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Sync to QuiverDM';
    }
  }
}

async function handleLogout() {
  await ext.runtime.sendMessage({ type: 'LOGOUT' });
  currentToken = null;
  logoutBtn.style.display = 'none';
  await init();
}

init();
