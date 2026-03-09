/**
 * AI prompt templates for the Lazy DM Session Prep Wizard.
 * Each prompt requests JSON output compatible with the SessionPrepData schema.
 */

export interface PrepContext {
  campaignName: string;
  campaignDescription?: string;
  recentRecap?: string;
  characters: Array<{ name: string; class?: string; background?: string; goals?: string }>;
  knownNpcs: Array<{ name: string; role?: string }>;
  looseHooks?: string[];
  // Brain context (optional — gracefully absent if Brain not yet seeded)
  brainHooks?: Array<{ text: string; urgency: 'low' | 'medium' | 'high' }>;
  brainThreats?: Array<{ name: string; urgency: number }>;
  npcMotivations?: Array<{ name: string; motivation?: string; fear?: string; loyalty?: string }>;
  factionTensions?: Array<{ factionA: string; factionB: string; type: string; strength: number }>;
}

// ---------------------------------------------------------------------------
// Step 2: Strong Start
// ---------------------------------------------------------------------------

export function buildStrongStartPrompt(context: PrepContext): string {
  const charList = context.characters.map((c) => `- ${c.name}${c.class ? ` (${c.class})` : ''}`).join('\n');
  const recap = context.recentRecap ? `\nRecent events: ${context.recentRecap}` : '';
  const hooks = context.brainHooks && context.brainHooks.length > 0
    ? `\nUnresolved hooks:\n${context.brainHooks.map(h => `- [${h.urgency}] ${h.text}`).join('\n')}`
    : '';
  const threats = context.brainThreats && context.brainThreats.length > 0
    ? `\nActive threats:\n${context.brainThreats.map(t => `- ${t.name} (urgency ${t.urgency.toFixed(1)})`).join('\n')}`
    : '';

  return `You are a Dungeon Master assistant helping plan a D&D session using the Lazy Dungeon Master method.

Campaign: ${context.campaignName}${recap}${hooks}${threats}

Player characters:
${charList}

Generate a strong session opening that drops the players immediately into action or an interesting situation. The strong start should be immersive, specific, and compelling — not a recap or slow warm-up.

Respond with JSON only in this format:
{
  "strongStart": "A vivid 2-4 sentence opening scene description that establishes immediate stakes or action."
}`;
}

// ---------------------------------------------------------------------------
// Step 3: Potential Scenes
// ---------------------------------------------------------------------------

export function buildScenesPrompt(context: PrepContext, strongStart: string): string {
  const charList = context.characters.map((c) => `- ${c.name}${c.class ? ` (${c.class})` : ''}`).join('\n');
  const recap = context.recentRecap ? `\nRecent events: ${context.recentRecap}` : '';
  const factionTensions = context.factionTensions && context.factionTensions.length > 0
    ? `\nFaction tensions:\n${context.factionTensions.map(f => `- ${f.factionA} ↔ ${f.factionB}: ${f.type} (strength ${f.strength.toFixed(1)})`).join('\n')}`
    : '';

  return `You are a Dungeon Master assistant helping plan a D&D session using the Lazy Dungeon Master method.

Campaign: ${context.campaignName}${recap}${factionTensions}

Strong start already planned: "${strongStart}"

Player characters:
${charList}

Generate 3-5 potential scenes or beats for this session. These are possibilities, not a railroad — the DM picks from them as needed. Each scene should be a distinct situation, encounter, or moment that could emerge from the strong start.

Respond with JSON only in this format:
{
  "scenes": [
    {
      "id": "unique-id",
      "title": "Short scene title",
      "description": "1-2 sentences describing the scene, what's at stake, and how players might engage with it.",
      "location": "Optional location name"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Step 4: Secrets & Clues
// ---------------------------------------------------------------------------

export function buildSecretsPrompt(context: PrepContext): string {
  const charList = context.characters.map((c) => `- ${c.name}${c.class ? ` (${c.class})` : ''}`).join('\n');
  const npcList = context.knownNpcs.slice(0, 8).map((n) => `- ${n.name}${n.role ? ` (${n.role})` : ''}`).join('\n');
  const recap = context.recentRecap ? `\nRecent events: ${context.recentRecap}` : '';
  const npcMotivations = context.npcMotivations && context.npcMotivations.length > 0
    ? `\nKnown NPC motivations:\n${context.npcMotivations.map(n => `- ${n.name}${n.motivation ? `: wants ${n.motivation}` : ''}${n.fear ? `, fears ${n.fear}` : ''}`).join('\n')}`
    : '';

  return `You are a Dungeon Master assistant helping plan a D&D session using the Lazy Dungeon Master method.

Campaign: ${context.campaignName}${recap}

Player characters:
${charList}

Known NPCs:
${npcList || '(none listed)'}${npcMotivations}

Generate 8-10 secrets and clues the players might discover during this session. These are world truths the DM knows but players don't yet — scattered across locations, NPCs, and objects. Mix minor revelations (NPC motivations) with significant ones (plot twists, world history).

Respond with JSON only in this format:
{
  "secretsAndClues": [
    {
      "id": "unique-id",
      "text": "One sentence stating the secret or clue.",
      "linkedTo": "Optional: NPC name, location, or item this clue is attached to"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Step 8: Loose Threads (detect from session recaps)
// ---------------------------------------------------------------------------

export function buildLooseThreadsPrompt(
  recaps: Array<{ sessionNumber: number; title?: string; recap: string; id: string }>
): string {
  const recapText = recaps
    .map((r) => `Session ${r.sessionNumber}${r.title ? ` — ${r.title}` : ''}:\n${r.recap}`)
    .join('\n\n---\n\n');

  return `You are a Dungeon Master assistant reviewing past D&D session recaps.

Below are recaps from recent sessions. Identify unresolved story threads, hanging plot hooks, unfulfilled promises, unanswered questions, or NPC situations that were introduced but never concluded.

Session recaps:
${recapText}

Respond with JSON only in this format:
{
  "looseThreads": [
    {
      "id": "unique-id",
      "text": "One sentence describing the unresolved thread.",
      "fromSessionId": "session-id-if-known",
      "fromSessionTitle": "session title if known"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Step 8 (Brain variant): Loose Threads from Brain hooks
// ---------------------------------------------------------------------------

export function buildLooseThreadsFromBrainPrompt(
  hooks: Array<{ text: string; urgency: 'low' | 'medium' | 'high'; createdSessionId?: string }>
): string {
  const hookList = hooks.map((h, i) => `${i + 1}. [${h.urgency} urgency] ${h.text}`).join('\n');

  return `You are a Dungeon Master assistant reviewing tracked story threads.

Below are unresolved plot hooks tracked by the DM Brain system, sorted by urgency:
${hookList}

Select the most narratively compelling threads and format them for the DM's session prep.

Respond with JSON only in this format:
{
  "looseThreads": [
    {
      "id": "unique-id",
      "text": "One sentence describing the unresolved thread.",
      "fromSessionId": "session-id-if-known"
    }
  ]
}`;
}
