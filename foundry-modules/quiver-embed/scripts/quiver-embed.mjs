// QuiverDM Embed Module — Foundry VTT v14

const MODULE_ID = 'quiver-embed'

// Module-level state
let currentSessionId = null
let pollingInterval = null

// ─── Join-page storage access flow ────────────────────────────────────────
// When embedded in the QuiverDM iframe, the browser blocks cross-origin
// cookies. We load /join first (no auth needed), request storage access with
// a user gesture, then navigate to /game.

;(() => {
  if (window.location.pathname !== '/join') return
  if (window.self === window.top) return
  const params = new URLSearchParams(window.location.search)
  if (params.get('quiver') !== '1') return

  document.addEventListener('DOMContentLoaded', async () => {
    // If we already have cookie access from a previous grant, skip straight to game.
    try {
      const hasAccess = await document.hasStorageAccess()
      if (hasAccess) {
        window.location.replace('/game?quiver=1')
        return
      }
    } catch {}

    // Inject a connect button over the join page UI.
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:12px;
      background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);
    `
    const btn = document.createElement('button')
    btn.textContent = 'Connect Foundry to QuiverDM'
    btn.style.cssText = `
      padding:14px 28px;background:#d97706;color:#000;border:none;
      border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);letter-spacing:0.02em;
    `
    const hint = document.createElement('p')
    hint.textContent = 'One-time permission needed to share your Foundry session with QuiverDM'
    hint.style.cssText = `color:#a0a0a0;font-size:13px;margin:0;text-align:center;max-width:320px;`
    overlay.appendChild(btn)
    overlay.appendChild(hint)
    document.body.appendChild(overlay)

    btn.addEventListener('click', async () => {
      btn.textContent = 'Requesting access…'
      btn.disabled = true
      try {
        await document.requestStorageAccess()
        window.location.replace('/game?quiver=1')
      } catch (err) {
        btn.textContent = 'Access denied'
        hint.textContent = 'Allow third-party cookies for this site in your browser settings, then reload.'
        btn.disabled = false
        console.error('[quiver-embed] storage access denied:', err)
      }
    })
  })
})()

// ─── Settings registration ─────────────────────────────────────────────────

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'quiverBaseUrl', {
    name: 'QuiverDM Base URL',
    hint: 'e.g. https://quiverdm.com',
    scope: 'world',
    config: true,
    type: String,
    default: 'https://quiverdm.com',
  })
  game.settings.register(MODULE_ID, 'campaignId', {
    name: 'Campaign ID',
    hint: 'The QuiverDM campaign CUID for this world',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  })
  game.settings.register(MODULE_ID, 'apiKey', {
    name: 'API Key',
    hint: 'Generate in QuiverDM → Campaign Settings → Foundry tab',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  })
})

// ─── Ready hook ───────────────────────────────────────────────────────────

Hooks.once('ready', () => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('quiver') === '1') {
    stripChrome()
  }
  if (!game.user.isGM) return
  registerCombatHooks()
  startJobPolling()
})

// ─── Chrome strip ─────────────────────────────────────────────────────────

function stripChrome() {
  const style = document.createElement('style')
  style.id = 'quiver-chrome-strip'
  style.textContent = `
    #navigation, #controls, #hotbar, #sidebar,
    #players, #pause, #fps, #logo,
    #interface { display: none !important; }
    #board, #canvas {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    }
    body { overflow: hidden; }
  `
  document.head.appendChild(style)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function cfg(key) {
  return game.settings.get(MODULE_ID, key)
}

async function postEvent(type, payload) {
  const baseUrl = cfg('quiverBaseUrl')
  const campaignId = cfg('campaignId')
  const apiKey = cfg('apiKey')
  if (!campaignId || !apiKey || !currentSessionId) return

  await fetch(`${baseUrl}/api/foundry/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Quiver-Key': apiKey,
    },
    body: JSON.stringify({
      campaignId,
      sessionId: currentSessionId,
      type,
      payload,
      foundryTimestamp: new Date().toISOString(),
    }),
  }).catch((err) => console.warn('[quiver-embed] event post failed:', err))
}

// ─── Combat event hooks ───────────────────────────────────────────────────

function registerCombatHooks() {
  Hooks.on('updateActor', (actor, diff) => {
    const hpDiff = diff?.system?.attributes?.hp
    if (!hpDiff) return
    const currentHp = actor.system.attributes.hp.value
    const maxHp = actor.system.attributes.hp.max
    postEvent('hp_change', { actorId: actor.id, actorName: actor.name, hp: currentHp, hpMax: maxHp })
    if (currentHp === 0) postEvent('actor_death', { actorId: actor.id, actorName: actor.name })
  })

  Hooks.on('createActiveEffect', (effect) => {
    const actor = effect.parent
    if (!actor || !(actor instanceof Actor)) return
    postEvent('condition_added', {
      actorId: actor.id, actorName: actor.name,
      conditionId: effect.id, conditionLabel: effect.name ?? effect.label,
    })
  })

  Hooks.on('deleteActiveEffect', (effect) => {
    const actor = effect.parent
    if (!actor || !(actor instanceof Actor)) return
    postEvent('condition_removed', {
      actorId: actor.id, actorName: actor.name,
      conditionId: effect.id, conditionLabel: effect.name ?? effect.label,
    })
  })

  Hooks.on('updateCombat', (combat, diff) => {
    if (diff.turn === undefined && diff.round === undefined && !diff.combatants) return
    const order = combat.turns.map((t) => ({
      actorId: t.actorId, actorName: t.name,
      initiative: t.initiative, defeated: t.isDefeated,
    }))
    postEvent('initiative_set', { order, round: combat.round, turn: combat.turn })
  })
}

// ─── Job polling ─────────────────────────────────────────────────────────

function startJobPolling() {
  if (pollingInterval) return
  pollJobs()
  pollingInterval = setInterval(pollJobs, 5000)
}

async function pollJobs() {
  const baseUrl = cfg('quiverBaseUrl')
  const campaignId = cfg('campaignId')
  const apiKey = cfg('apiKey')
  if (!campaignId || !apiKey) return

  let data
  try {
    const res = await fetch(`${baseUrl}/api/foundry/jobs?campaignId=${campaignId}`, {
      headers: { 'X-Quiver-Key': apiKey },
    })
    data = await res.json()
  } catch {
    return
  }

  for (const job of data.jobs ?? []) {
    let status = 'delivered'
    let error = null
    try {
      if (job.type === 'actor_upsert') await handleActorUpsert(job.payload, job.id)
      else if (job.type === 'token_place') await handleTokenPlace(job.payload)
      else if (job.type === 'scene_activate') await handleSceneActivate(job.payload)
    } catch (err) {
      status = 'error'
      error = String(err)
      console.error(`[quiver-embed] job ${job.id} (${job.type}) failed:`, err)
    }

    fetch(`${baseUrl}/api/foundry/jobs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Quiver-Key': apiKey },
      body: JSON.stringify({ jobId: job.id, campaignId, status, error }),
    }).catch(() => {})
  }
}

async function handleActorUpsert(actorData, jobId) {
  const sourceId = actorData._quiverSourceId ?? jobId
  const existing = game.actors.find((a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId)
  if (existing) {
    const { _quiverSourceId: _s, flags: _f, ...updateData } = actorData
    await existing.update(updateData)
  } else {
    await Actor.create({ ...actorData, flags: { [MODULE_ID]: { sourceId } } })
  }
}

async function handleTokenPlace(payload) {
  const scene = game.scenes.active
  if (!scene) throw new Error('No active scene — activate a scene in Foundry first')
  const { sessionId, npcSourceIds = [], playerSourceIds = [] } = payload
  if (sessionId) currentSessionId = sessionId
  const combat = game.combats.active
  if (combat && sessionId) await combat.setFlag(MODULE_ID, 'sessionId', sessionId)
  const gridSize = scene.grid?.size ?? 100
  const tokenData = []
  let col = 1
  for (const sourceId of npcSourceIds) {
    const actor = game.actors.find((a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId)
    if (!actor) continue
    tokenData.push({ name: actor.name, actorId: actor.id, x: col * gridSize, y: gridSize, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE })
    col++
  }
  col = 1
  for (const sourceId of playerSourceIds) {
    const actor = game.actors.find((a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId)
    if (!actor) continue
    tokenData.push({ name: actor.name, actorId: actor.id, x: col * gridSize, y: (scene.height ?? 1000) - gridSize * 2, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY })
    col++
  }
  if (tokenData.length > 0) await scene.createEmbeddedDocuments('Token', tokenData)
}

async function handleSceneActivate(payload) {
  const scene = game.scenes.get(payload.sceneId)
  if (!scene) throw new Error(`Scene ${payload.sceneId} not found in this world`)
  await scene.activate()
}
