function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

type NpcExportInput = {
  id: string;
  name: string;
  description?: string | null;
  faction?: string | null;
  role?: string | null;
  imageUrl?: string | null;
  stats?: unknown;
};

type HomebrewExportInput = {
  id: string;
  name: string;
  type: string;
  data?: unknown;
  imageUrl?: string | null;
};

type SessionExportInput = {
  id: string;
  sessionNumber: number;
  title?: string | null;
  aiSummary?: string | null;
  playerRecap?: string | null;
  date?: Date | null;
};

export function mapNpcToActor(npc: NpcExportInput): Record<string, unknown> {
  const stats = asRecord(npc.stats);

  return {
    name: npc.name,
    type: 'npc',
    img: npc.imageUrl ?? 'icons/svg/mystery-man.svg',
    system: {
      abilities: {
        str: { value: asNumber(stats.str ?? stats.strength, 10) },
        dex: { value: asNumber(stats.dex ?? stats.dexterity, 10) },
        con: { value: asNumber(stats.con ?? stats.constitution, 10) },
        int: { value: asNumber(stats.int ?? stats.intelligence, 10) },
        wis: { value: asNumber(stats.wis ?? stats.wisdom, 10) },
        cha: { value: asNumber(stats.cha ?? stats.charisma, 10) },
      },
      attributes: {
        ac: { flat: asNullableNumber(stats.ac ?? stats.armorClass) },
        hp: {
          value: asNullableNumber(stats.hp ?? stats.hitPoints ?? stats.maxHp),
          max: asNullableNumber(stats.maxHp ?? stats.hp ?? stats.hitPoints),
        },
        movement: { walk: asNullableNumber(stats.speed ?? stats.walkSpeed) },
      },
      details: {
        biography: { value: npc.description ?? '' },
        type: {
          value: asString(stats.type, 'humanoid'),
          subtype: asString(stats.subtype),
        },
        cr: asNullableNumber(stats.cr ?? stats.challengeRating),
        alignment: asString(stats.alignment),
        race: asString(stats.race, npc.faction ?? ''),
        source: 'QuiverDM',
      },
      traits: {
        size: asString(stats.size, 'med'),
        languages: { value: asStringArray(stats.languages), custom: '' },
        senses: {
          darkvision: asNumber(stats.darkvision, 0),
          blindsight: 0,
          tremorsense: 0,
          truesight: 0,
          units: 'ft',
        },
      },
    },
    flags: {
      quiverdm: {
        sourceId: npc.id,
        sourceType: 'npc',
        importedAt: new Date().toISOString(),
      },
    },
  };
}

export function mapHomebrewToItem(homebrew: HomebrewExportInput): Record<string, unknown> {
  const data = asRecord(homebrew.data);
  const foundryType = mapHomebrewTypeToFoundry(homebrew.type);
  const components = asRecord(data.components);

  return {
    name: homebrew.name,
    type: foundryType,
    img: homebrew.imageUrl ?? 'icons/svg/item-bag.svg',
    system: {
      description: { value: asString(data.description, asString(data.text)) },
      source: 'QuiverDM',
      ...(foundryType === 'spell'
        ? {
            level: asNumber(data.level, 0),
            school: mapSpellSchool(asString(data.school)),
            components: {
              vocal: Boolean(components.verbal),
              somatic: Boolean(components.somatic),
              material: Boolean(components.material),
              concentration: Boolean(data.concentration),
              ritual: Boolean(data.ritual),
            },
            activation: { type: mapCastingTime(asString(data.castingTime, 'action')), cost: 1 },
            range: { value: parseRange(asString(data.range)), units: 'ft' },
            duration: { value: asString(data.duration), units: 'inst' },
          }
        : {}),
      ...(foundryType === 'equipment' || foundryType === 'weapon'
        ? {
            rarity: asString(data.rarity, 'common'),
            equipped: false,
            attunement: data.requiresAttunement ? 1 : 0,
            weight: asNumber(data.weight, 0),
            price: { value: asNumber(data.cost, 0), denomination: 'gp' },
          }
        : {}),
    },
    flags: {
      quiverdm: {
        sourceId: homebrew.id,
        sourceType: 'homebrew',
        importedAt: new Date().toISOString(),
      },
    },
  };
}

export function mapSessionToJournal(session: SessionExportInput): Record<string, unknown> {
  const pages: Array<Record<string, unknown>> = [];

  if (session.aiSummary) {
    pages.push({
      name: 'Session Summary',
      type: 'text',
      text: { format: 1, content: `<p>${session.aiSummary.replace(/\n/g, '</p><p>')}</p>` },
      sort: 100000,
    });
  }

  if (session.playerRecap) {
    pages.push({
      name: 'Player Recap',
      type: 'text',
      text: { format: 1, content: `<p>${session.playerRecap.replace(/\n/g, '</p><p>')}</p>` },
      sort: 200000,
    });
  }

  return {
    name: session.title ?? `Session ${session.sessionNumber}`,
    pages:
      pages.length > 0
        ? pages
        : [
            {
              name: 'Notes',
              type: 'text',
              text: { format: 1, content: '<p>No summary available.</p>' },
              sort: 100000,
            },
          ],
    flags: {
      quiverdm: {
        sourceId: session.id,
        sourceType: 'session',
        importedAt: new Date().toISOString(),
      },
    },
  };
}

function mapHomebrewTypeToFoundry(type: string): string {
  if (type === 'spell') {
    return 'spell';
  }

  if (type === 'creature') {
    return 'npc';
  }

  if (type === 'weapon') {
    return 'weapon';
  }

  if (type === 'armor') {
    return 'equipment';
  }

  return 'equipment';
}

function mapSpellSchool(school: string): string {
  const map: Record<string, string> = {
    abjuration: 'abj',
    conjuration: 'con',
    divination: 'div',
    enchantment: 'enc',
    evocation: 'evo',
    illusion: 'ill',
    necromancy: 'nec',
    transmutation: 'trs',
  };

  return map[school.toLowerCase()] ?? 'evo';
}

function mapCastingTime(castingTime: string): string {
  const normalized = castingTime.toLowerCase();

  if (normalized.includes('bonus')) {
    return 'bonus';
  }

  if (normalized.includes('reaction')) {
    return 'reaction';
  }

  if (normalized.includes('minute')) {
    return 'minute';
  }

  return 'action';
}

function parseRange(range: string): number {
  const numeric = Number.parseInt(range, 10);
  return Number.isNaN(numeric) ? 0 : numeric;
}
