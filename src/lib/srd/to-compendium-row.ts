/**
 * Adapt bundled SRD data into the row shape the v3 Compendium renders, so SRD
 * monsters sit alongside campaign homebrew in the same list + statblock pane.
 *
 * The Compendium's statblock adapter reads a free-form `data` blob (ac, hp,
 * abilities, speed-as-string, cr, actions[{name,description}], defence arrays).
 * `srdMonsterToRow` produces exactly that shape so the detail pane is unchanged.
 */

import type { SrdMonster } from './monsters';
import type { SrdCondition } from './conditions';
import type { SrdRule } from './rules';
import { spellLevelLabel, type SrdSpell } from './spells';

/** A Compendium list row — superset of the homebrew row, with an SRD flag. */
export interface CompendiumRow {
  id: string;
  name: string;
  type: string;
  tags?: string[] | null;
  sourceType?: string | null;
  /** True for bundled SRD reference entries (rendered without the ✦ homebrew flag). */
  isSrd?: boolean;
  data?: unknown;
}

/** Join a 5e speed record into "30 ft., fly 60 ft." form. */
function formatSpeed(speed: Record<string, number | string>): string {
  const parts: string[] = [];
  for (const [mode, value] of Object.entries(speed)) {
    if (mode === 'hover') continue; // boolean flag, not a distance
    parts.push(mode === 'walk' ? `${value} ft.` : `${mode} ${value} ft.`);
  }
  return parts.join(', ');
}

/** Wrap a non-empty defence string as a single-element array (or undefined). */
function defence(value: string): string[] | undefined {
  return value && value.trim() ? [value] : undefined;
}

export function srdMonsterToRow(m: SrdMonster): CompendiumRow {
  return {
    id: `srd:${m.slug}`,
    name: m.name,
    type: 'creature',
    isSrd: true,
    sourceType: 'srd',
    tags: m.subtype ? [m.type, m.subtype] : [m.type],
    data: {
      size: m.size,
      type: m.type,
      alignment: m.alignment,
      cr: m.cr,
      xp: m.xp,
      ac: m.armorClass,
      acNote: m.armorDesc || undefined,
      hp: m.hitPoints,
      hpDice: m.hitDice || undefined,
      speed: formatSpeed(m.speed),
      abilities: m.abilityScores,
      damageResistances: defence(m.damageResistances),
      damageImmunities: defence(m.damageImmunities),
      conditionImmunities: defence(m.conditionImmunities),
      senses: m.senses || undefined,
      languages: m.languages || undefined,
      traits: m.traits.map((t) => ({ name: t.name, description: t.desc })),
      actions: m.actions.map((a) => ({ name: a.name, description: a.desc })),
      reactions: m.reactions.map((r) => ({ name: r.name, description: r.desc })),
      legendaryActions: m.legendaryActions.map((l) => ({ name: l.name, description: l.desc })),
    },
  };
}

/** Map an SRD condition into a text-detail Compendium row. */
export function srdConditionToRow(c: SrdCondition): CompendiumRow {
  return {
    id: `srd-condition:${c.slug}`,
    name: c.name,
    type: 'condition',
    isSrd: true,
    sourceType: 'srd',
    data: { description: c.description },
  };
}

/** Map an SRD rule into a text-detail Compendium row (tagged by category). */
export function srdRuleToRow(r: SrdRule): CompendiumRow {
  return {
    id: `srd-rule:${r.slug}`,
    name: r.name,
    type: 'rule',
    isSrd: true,
    sourceType: 'srd',
    tags: [r.category],
    data: { description: r.description, category: r.category },
  };
}

/** Map an SRD spell into a spell-detail Compendium row. */
export function srdSpellToRow(s: SrdSpell): CompendiumRow {
  const levelLabel = s.level === 0 ? 'Cantrip' : `${spellLevelLabel(s.level)}-level`;
  return {
    id: `srd-spell:${s.slug}`,
    name: s.name,
    type: 'spell',
    isSrd: true,
    sourceType: 'srd',
    tags: [levelLabel, s.school],
    data: {
      level: s.level,
      school: s.school,
      castingTime: s.castingTime,
      range: s.range,
      components: s.components,
      material: s.material,
      duration: s.duration,
      concentration: s.concentration,
      ritual: s.ritual,
      classes: s.classes,
      description: s.description,
      higherLevel: s.higherLevel,
    },
  };
}
