// Shared types between the browser extension and QuiverDM server.
// Extension imports a copy; server imports directly.

// ---------------------------------------------------------------------------
// WebSocket: Extension → Server
// ---------------------------------------------------------------------------

export interface ExtAuthMessage {
  type: 'ext.auth';
  token: string; // JWT access token
}

export interface ExtCharacterUpdateMessage {
  type: 'ext.character.update';
  sessionId: string;
  characterId: string; // DDB character ID (string)
  patch: CharacterStatePatch;
}

export interface ExtRollMessage {
  type: 'ext.roll';
  sessionId: string;
  characterId: string;
  roll: RollEvent;
}

export interface ExtCombatStartMessage {
  type: 'ext.combat.start';
  sessionId: string;
  initiativeOrder: InitiativeEntry[];
}

export interface ExtCombatEndMessage {
  type: 'ext.combat.end';
  sessionId: string;
}

export interface ExtTokenPlacedMessage {
  type: 'ext.token.placed';
  sessionId: string;
  npcDdbId: string;
  tokenData: Record<string, unknown>;
}

export type ExtIncomingMessage =
  | ExtAuthMessage
  | ExtCharacterUpdateMessage
  | ExtRollMessage
  | ExtCombatStartMessage
  | ExtCombatEndMessage
  | ExtTokenPlacedMessage;

// ---------------------------------------------------------------------------
// WebSocket: Server → Session Cockpit
// ---------------------------------------------------------------------------

export interface ExtPartyUpdateOutgoing {
  type: 'session.party.update';
  sessionId: string;
  source: 'extension';
  characterId: string;
  patch: CharacterStatePatch;
}

export interface ExtRollLogOutgoing {
  type: 'session.roll.log';
  sessionId: string;
  source: 'extension';
  characterId: string;
  roll: RollEvent;
}

export interface ExtCombatUpdateOutgoing {
  type: 'session.combat.update';
  sessionId: string;
  source: 'extension';
  event: 'start' | 'end';
  initiativeOrder?: InitiativeEntry[];
}

// ---------------------------------------------------------------------------
// Import Payloads: Extension → Server (via tRPC)
// ---------------------------------------------------------------------------

export interface DdbMonsterImportPayload {
  ddbId: string;
  name: string;
  type: string;
  alignment: string;
  ac: number;
  acNote?: string;
  hp: number;
  hpDice?: string;
  speed: Record<string, number>;
  abilityScores: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  savingThrows: Record<string, number>;
  skills: Record<string, number>;
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  senses: Record<string, string | number>;
  languages: string;
  cr: string;
  xp: number;
  actions: DdbAction[];
  legendaryActions?: DdbAction[];
  reactions?: DdbAction[];
  traits?: DdbAction[];
  sourceUrl: string;
}

export interface DdbAction {
  name: string;
  description: string;
  attackBonus?: number;
  damageDice?: string;
  damageBonus?: number;
  saveDc?: number;
  saveType?: string;
}

export interface DdbEncounterImportPayload {
  ddbId: string;
  name: string;
  creatures: DdbEncounterCreature[];
  difficulty?: string;
  notes?: string;
}

export interface DdbEncounterCreature {
  ddbId: string;
  name: string;
  quantity: number;
  cr?: string;
  xp?: number;
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface CharacterStatePatch {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  deathSaves?: { successes: number; failures: number };
  conditions?: string[];
  spellSlots?: Record<string, { used: number; total: number }>;
  exhaustion?: number;
}

export interface RollEvent {
  formula: string;
  result: number;
  breakdown: number[];
  label?: string;
}

export interface InitiativeEntry {
  characterId?: string;
  npcName?: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
}

// ---------------------------------------------------------------------------
// JWT payload
// ---------------------------------------------------------------------------

export interface ExtensionTokenPayload {
  sub: string;   // userId
  type: 'extension-access' | 'extension-refresh';
  iat: number;
  exp: number;
}
