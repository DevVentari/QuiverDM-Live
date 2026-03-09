export type VoiceIntentType = 'navigate' | 'search' | 'dice_roll' | 'create' | 'query' | 'unknown';

export interface VoiceIntent {
  type: VoiceIntentType;
  target: string;
  raw: string;
}

const NAVIGATE_RE = /^(?:go to|navigate to|open|show me)\s+(.+)/i;
const SEARCH_RE = /^(?:find|search for|who is|look up|show)\s+(.+)/i;
const DICE_RE = /^(?:roll\s+)?(\d*d\d+(?:[+-]\d+)?)|^roll\s+dice/i;
const CREATE_RE = /^(?:create|add|new)\s+(.+)/i;
const QUERY_RE = /^(?:what happened|tell me about|what is|what are|describe|explain|how|why)\s*(.+)?/i;

export function classifyIntent(transcript: string): VoiceIntent {
  const text = transcript.trim();

  const diceMatch = text.match(/(\d*d\d+(?:[+-]\d+)?)/i);
  if (diceMatch || /^roll\s+dice/i.test(text)) {
    return { type: 'dice_roll', target: diceMatch?.[1] ?? 'd20', raw: text };
  }

  const navMatch = text.match(NAVIGATE_RE);
  if (navMatch) {
    return { type: 'navigate', target: navMatch[1].trim(), raw: text };
  }

  const searchMatch = text.match(SEARCH_RE);
  if (searchMatch) {
    return { type: 'search', target: searchMatch[1].trim(), raw: text };
  }

  const createMatch = text.match(CREATE_RE);
  if (createMatch) {
    return { type: 'create', target: createMatch[1].trim(), raw: text };
  }

  const queryMatch = text.match(QUERY_RE);
  if (queryMatch) {
    return { type: 'query', target: queryMatch[1]?.trim() ?? text, raw: text };
  }

  return { type: 'unknown', target: text, raw: text };
}
