/**
 * Pure function: D&D Beyond monster page HTML → structured DdbMonsterData.
 * No I/O. Testable against saved HTML fixtures.
 */

import * as cheerio from 'cheerio';

export interface AbilityBlock {
  score: number;
  mod: number;
  save?: number;
}

export interface MonsterRoll {
  notation: string;
  type: string;
  action?: string;
  damageType?: string;
}

export interface MonsterAttack {
  kind: 'melee_weapon' | 'ranged_weapon' | 'melee_or_ranged_weapon' | 'spell';
  toHit?: number;
  reach?: string;
  range?: string;
  target?: string;
  hit?: Array<{ averageDamage?: number; damageDice?: string; damageType?: string }>;
  saveDc?: number;
  saveAbility?: string;
}

export interface MonsterFeature {
  name: string;
  description: string;
  rolls?: MonsterRoll[];
  attack?: MonsterAttack;
  recharge?: string;
  usesPerDay?: string;
}

export interface MonsterSpellcastingBlock {
  heading: string;
  description: string;
  innate: boolean;
  casterLevel?: number;
  ability?: string;
  saveDc?: number;
  attackBonus?: number;
  groups: Array<{ heading: string; spells: string[] }>;
}

export interface DdbMonsterData {
  ddbId: string;
  name: string;
  size?: string;
  type: string;
  alignment: string;

  ac: number;
  acDescription?: string;
  hp: number;
  hpDice?: string;
  speed: string;

  abilities: {
    str: AbilityBlock;
    dex: AbilityBlock;
    con: AbilityBlock;
    int: AbilityBlock;
    wis: AbilityBlock;
    cha: AbilityBlock;
  };

  savingThrows?: string;
  skills?: string;
  damageVulnerabilities?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses?: string;
  passivePerception?: number;
  languages?: string;

  cr: string;
  crNumeric?: number;
  xp: number;
  proficiencyBonus?: number;

  traits: MonsterFeature[];
  actions: MonsterFeature[];
  bonusActions: MonsterFeature[];
  reactions: MonsterFeature[];
  legendaryActions: MonsterFeature[];
  legendaryActionsDescription?: string;
  lairActionsDescription?: string;
  lairActions: MonsterFeature[];

  spellcasting: MonsterSpellcastingBlock[];

  description?: string;
  imageUrl?: string;
  source?: string;
  sourceUrl: string;
}

const SIZE_RE = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i;

const CR_TABLE: Record<string, number> = {
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
};

function parseCrNumeric(cr: string): number | undefined {
  const trimmed = cr.trim();
  if (CR_TABLE[trimmed] !== undefined) return CR_TABLE[trimmed];
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function getAbility($block: cheerio.Cheerio<any>, label: string): AbilityBlock {
  const $stat = $block.find(`.ability-block__stat--${label}`).first();
  const score = parseInt($stat.find('.ability-block__score').text().trim(), 10) || 10;
  const modText = $stat.find('.ability-block__modifier').text().trim();
  const modMatch = modText.match(/-?\d+/);
  const mod = modMatch ? parseInt(modMatch[0], 10) : Math.floor((score - 10) / 2);
  return { score, mod };
}

function attachSaves(abilities: DdbMonsterData['abilities'], savingThrows: string | undefined): void {
  if (!savingThrows) return;
  const map: Record<string, keyof DdbMonsterData['abilities']> = {
    STR: 'str', DEX: 'dex', CON: 'con', INT: 'int', WIS: 'wis', CHA: 'cha',
  };
  for (const m of savingThrows.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA)\s*([+-]\d+)/gi)) {
    const key = map[m[1].toUpperCase()];
    if (key) abilities[key].save = parseInt(m[2], 10);
  }
}

function getAttribute($: cheerio.CheerioAPI, label: string): { value: string; extra: string } {
  let value = '', extra = '';
  $('.mon-stat-block__attribute').each((_, el) => {
    const $el = $(el);
    if ($el.find('.mon-stat-block__attribute-label').text().trim() === label) {
      value = $el.find('.mon-stat-block__attribute-data-value, .mon-stat-block__attribute-value').first().text().trim();
      extra = $el.find('.mon-stat-block__attribute-data-extra').first().text().trim();
    }
  });
  return { value, extra };
}

function getTidbit($: cheerio.CheerioAPI, label: string): string {
  let val = '';
  $('.mon-stat-block__tidbit').each((_, el) => {
    const $el = $(el);
    if ($el.find('.mon-stat-block__tidbit-label').text().trim() === label) {
      val = $el.find('.mon-stat-block__tidbit-data').text().replace(/\s+/g, ' ').trim();
    }
  });
  return val;
}

function parseHpAttribute(extra: string): string | undefined {
  const m = extra.match(/\(([^)]+)\)/);
  return m ? m[1] : undefined;
}

function parseFeaturesFromContent($: cheerio.CheerioAPI, $content: cheerio.Cheerio<any>): MonsterFeature[] {
  const features: MonsterFeature[] = [];
  $content.find('p').each((_, p) => {
    const $p = $(p);
    // Feature paragraphs start with <em><strong>Name.</strong></em> ... or <strong><em>Name.</em></strong>
    const $strong = $p.find('strong').first();
    const strongText = $strong.text().trim();
    if (!strongText) {
      // Continuation paragraph (e.g. spellcasting spell list, legendary preamble, etc.)
      const last = features[features.length - 1];
      if (last) {
        last.description = (last.description + '\n' + $p.text().replace(/\s+/g, ' ').trim()).trim();
      }
      return;
    }
    // Strip trailing period/colon from name
    const name = strongText.replace(/[.:]\s*$/, '').trim();
    // Description = paragraph text minus the leading strong portion
    const fullText = $p.text().replace(/\s+/g, ' ').trim();
    const description = fullText.startsWith(strongText)
      ? fullText.slice(strongText.length).replace(/^[.:\s]+/, '').trim()
      : fullText;

    const rolls: MonsterRoll[] = [];
    $p.find('span[data-dicenotation]').each((__, span) => {
      const $s = $(span);
      rolls.push({
        notation: $s.attr('data-dicenotation') ?? '',
        type: $s.attr('data-rolltype') ?? 'roll',
        action: $s.attr('data-rollaction') ?? undefined,
        damageType: $s.attr('data-rolldamagetype') ?? undefined,
      });
    });

    const feature: MonsterFeature = { name, description };
    if (rolls.length) feature.rolls = rolls;

    // Recharge / uses per day
    const rechargeMatch = description.match(/Recharge\s+([\d–\-]+)/i);
    if (rechargeMatch) feature.recharge = rechargeMatch[1];
    const usesMatch = name.match(/\(([^)]+)\)$/);
    if (usesMatch && /\/(Day|Rest|Short|Long)/i.test(usesMatch[1])) feature.usesPerDay = usesMatch[1];

    // Attack parsing
    feature.attack = parseAttack(description, rolls);

    features.push(feature);
  });
  return features;
}

function parseAttack(description: string, rolls: MonsterRoll[]): MonsterAttack | undefined {
  const meleeOnly = /Melee\s+Weapon\s+Attack/i.test(description);
  const rangedOnly = /Ranged\s+Weapon\s+Attack/i.test(description);
  const both = /Melee\s+or\s+Ranged\s+Weapon\s+Attack/i.test(description);
  const spell = /Melee\s+Spell\s+Attack|Ranged\s+Spell\s+Attack/i.test(description);
  if (!meleeOnly && !rangedOnly && !both && !spell) return undefined;

  const kind: MonsterAttack['kind'] = both
    ? 'melee_or_ranged_weapon'
    : spell
    ? 'spell'
    : meleeOnly
    ? 'melee_weapon'
    : 'ranged_weapon';

  const toHitRoll = rolls.find(r => r.type === 'to hit');
  const toHitMatch = toHitRoll?.notation.match(/^1d20([+-]\d+)$/);
  const toHit = toHitMatch ? parseInt(toHitMatch[1], 10) : undefined;

  const reachMatch = description.match(/reach\s+([\d ./]+ft\.?)/i);
  const rangeMatch = description.match(/range\s+([\d/]+\s*ft\.?(?:\s*\/\s*[\d/]+\s*ft\.?)?)/i);
  const targetMatch = description.match(/,\s*(one [^.,]+|all [^.,]+)/i);

  const hits: NonNullable<MonsterAttack['hit']> = [];
  for (const r of rolls.filter(r => r.type === 'damage')) {
    const dmgMatch = r.notation.match(/(\d+d\d+(?:[+-]\d+)?)/);
    hits.push({
      damageDice: dmgMatch ? dmgMatch[1] : r.notation,
      damageType: r.damageType,
    });
  }
  // Pull average damage from "Hit: <avg> (<dice>) <type> damage" prose
  const avgMatches = [...description.matchAll(/Hit:\s*(\d+)\s*\(/g)];
  for (let i = 0; i < hits.length && i < avgMatches.length; i++) {
    hits[i].averageDamage = parseInt(avgMatches[i][1], 10);
  }

  return {
    kind,
    toHit,
    reach: reachMatch?.[1],
    range: rangeMatch?.[1],
    target: targetMatch?.[1],
    hit: hits.length > 0 ? hits : undefined,
  };
}

function detectSpellcasting(features: MonsterFeature[]): { remaining: MonsterFeature[]; spellcasting: MonsterSpellcastingBlock[] } {
  const blocks: MonsterSpellcastingBlock[] = [];
  const remaining: MonsterFeature[] = [];
  for (const f of features) {
    if (/^(Innate\s+)?Spellcasting$/i.test(f.name) || /Spellcasting/i.test(f.name)) {
      const innate = /^Innate/i.test(f.name);
      const desc = f.description;
      const block: MonsterSpellcastingBlock = {
        heading: f.name,
        description: desc,
        innate,
        groups: [],
      };
      const dcMatch = desc.match(/spell save DC\s*(\d+)/i);
      if (dcMatch) block.saveDc = parseInt(dcMatch[1], 10);
      const atkMatch = desc.match(/([+-]\d+)\s+to hit with spell attacks/i);
      if (atkMatch) block.attackBonus = parseInt(atkMatch[1], 10);
      const lvlMatch = desc.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i);
      if (lvlMatch) block.casterLevel = parseInt(lvlMatch[1], 10);
      const abilMatch = desc.match(/uses\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
      if (abilMatch) block.ability = abilMatch[1];

      // Spell groups are continuation lines like "At will: x, y" / "1/day each: a, b" / "Cantrips (at will): foo, bar" / "1st Level (4 slots): ..."
      const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        const heading = line.slice(0, colon).trim();
        const rest = line.slice(colon + 1).trim();
        if (!heading || !rest) continue;
        // Heuristic: only treat as a group if heading looks like a slot/freq descriptor
        if (!/(at will|day|rest|short rest|long rest|cantrip|level|slot)/i.test(heading)) continue;
        const spells = rest
          .replace(/\([^)]*\)/g, '')
          .split(/,|;/)
          .map(s => s.trim())
          .filter(Boolean);
        block.groups.push({ heading, spells });
      }
      blocks.push(block);
    } else {
      remaining.push(f);
    }
  }
  return { remaining, spellcasting: blocks };
}

export function parseMonsterHtml(
  html: string,
  ddbId: string,
  url: string
): DdbMonsterData | null {
  const $ = cheerio.load(html);
  const $stat = $('.mon-stat-block').first();
  const name = $stat.find('.mon-stat-block__name-link, .mon-stat-block__name').first().text().trim();
  if (!name) return null;

  // header: "Medium Humanoid (Elf), Neutral Evil"
  const meta = $stat.find('.mon-stat-block__meta').first().text().replace(/\s+/g, ' ').trim();
  const lastComma = meta.lastIndexOf(',');
  const typeFull = lastComma >= 0 ? meta.slice(0, lastComma).trim() : meta;
  const alignment = lastComma >= 0 ? meta.slice(lastComma + 1).trim() : 'unaligned';
  const sizeMatch = typeFull.match(SIZE_RE);
  const size = sizeMatch?.[1];

  const ac = getAttribute($, 'Armor Class');
  const hp = getAttribute($, 'Hit Points');
  const speed = getAttribute($, 'Speed');

  const $abilityBlock = $('.ability-block').first();
  const abilities = {
    str: getAbility($abilityBlock, 'str'),
    dex: getAbility($abilityBlock, 'dex'),
    con: getAbility($abilityBlock, 'con'),
    int: getAbility($abilityBlock, 'int'),
    wis: getAbility($abilityBlock, 'wis'),
    cha: getAbility($abilityBlock, 'cha'),
  };

  const savingThrows = getTidbit($, 'Saving Throws') || undefined;
  const skills = getTidbit($, 'Skills') || undefined;
  const damageVulnerabilities = getTidbit($, 'Damage Vulnerabilities') || undefined;
  const damageResistances = getTidbit($, 'Damage Resistances') || undefined;
  const damageImmunities = getTidbit($, 'Damage Immunities') || undefined;
  const conditionImmunities = getTidbit($, 'Condition Immunities') || undefined;
  const senses = getTidbit($, 'Senses') || undefined;
  const languages = getTidbit($, 'Languages') || undefined;
  const challenge = getTidbit($, 'Challenge');
  const profBonusRaw = getTidbit($, 'Proficiency Bonus');

  const passivePerceptionMatch = senses?.match(/passive Perception\s*(\d+)/i);
  const passivePerception = passivePerceptionMatch ? parseInt(passivePerceptionMatch[1], 10) : undefined;

  const crMatch = challenge.match(/^([\d/]+)\s*\((\d+(?:[\s,]\d+)*)\s*XP\)/i);
  const cr = crMatch?.[1] ?? '0';
  const xp = crMatch ? parseInt(crMatch[2].replace(/[\s,]/g, ''), 10) : 0;
  const profBonus = profBonusRaw ? parseInt(profBonusRaw.replace(/[+]/, ''), 10) || undefined : undefined;

  attachSaves(abilities, savingThrows);

  // Parse description blocks (traits, actions, bonus actions, reactions, legendary, lair)
  const sections: Record<string, MonsterFeature[]> = {
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    lairActions: [],
  };
  let legendaryDescription: string | undefined;
  let lairDescription: string | undefined;

  $('.mon-stat-block__description-block').each((_, block) => {
    const $b = $(block);
    const heading = $b.find('.mon-stat-block__description-block-heading').first().text().trim();
    const $content = $b.find('.mon-stat-block__description-block-content').first();
    const features = parseFeaturesFromContent($, $content);
    if (!heading) {
      sections.traits.push(...features);
    } else if (/^Actions?$/i.test(heading)) {
      sections.actions.push(...features);
    } else if (/^Bonus Actions?$/i.test(heading)) {
      sections.bonusActions.push(...features);
    } else if (/^Reactions?$/i.test(heading)) {
      sections.reactions.push(...features);
    } else if (/^Legendary Actions?$/i.test(heading)) {
      // First feature is often the preamble (no bold name) — but parseFeaturesFromContent
      // skips paragraphs without a leading <strong>. Capture preamble separately.
      const preamble = $content
        .children('p')
        .filter((__, p) => !$(p).find('strong').length)
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (preamble) legendaryDescription = preamble;
      sections.legendaryActions.push(...features);
    } else if (/^Lair Actions?$/i.test(heading)) {
      const preamble = $content
        .children('p')
        .filter((__, p) => !$(p).find('strong').length)
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (preamble) lairDescription = preamble;
      sections.lairActions.push(...features);
    } else {
      // Unknown section — bucket as traits
      sections.traits.push(...features);
    }
  });

  // Spellcasting features may appear under Traits or Actions; detect and split out.
  const traitsExtract = detectSpellcasting(sections.traits);
  sections.traits = traitsExtract.remaining;
  const actionsExtract = detectSpellcasting(sections.actions);
  sections.actions = actionsExtract.remaining;
  const spellcasting = [...traitsExtract.spellcasting, ...actionsExtract.spellcasting];

  // Lore description
  const description = $('.mon-details__description-block-content').first().text().replace(/\s+/g, ' ').trim() || undefined;

  // Image
  const imageUrl = $('.details-aside .image img, .monster-image').first().attr('src') || undefined;

  // Source citation
  const source = $('.monster-source').first().text().replace(/\s+/g, ' ').trim() || undefined;

  return {
    ddbId,
    name,
    size,
    type: typeFull,
    alignment,
    ac: parseInt(ac.value, 10) || 10,
    acDescription: ac.extra || undefined,
    hp: parseInt(hp.value, 10) || 1,
    hpDice: parseHpAttribute(hp.extra) || undefined,
    speed: speed.value || '30 ft.',
    abilities,
    savingThrows,
    skills,
    damageVulnerabilities,
    damageResistances,
    damageImmunities,
    conditionImmunities,
    senses,
    passivePerception,
    languages,
    cr,
    crNumeric: parseCrNumeric(cr),
    xp,
    proficiencyBonus: profBonus,
    traits: sections.traits,
    actions: sections.actions,
    bonusActions: sections.bonusActions,
    reactions: sections.reactions,
    legendaryActions: sections.legendaryActions,
    legendaryActionsDescription: legendaryDescription,
    lairActionsDescription: lairDescription,
    lairActions: sections.lairActions,
    spellcasting,
    description,
    imageUrl: imageUrl ? (imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl) : undefined,
    source,
    sourceUrl: url,
  };
}
