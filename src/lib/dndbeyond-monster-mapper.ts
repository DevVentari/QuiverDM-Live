import type { DdbMonsterImportPayload } from '@/lib/extension-types';

export interface MappedNpc {
  name: string;
  description: string;
  faction: string;
  role: string;
  tags: string[];
  stats: Record<string, unknown>;
}

export function mapDdbMonsterToNpc(monster: DdbMonsterImportPayload): MappedNpc {
  const description = [
    `${monster.type} (CR ${monster.cr})`,
    monster.alignment,
  ]
    .filter(Boolean)
    .join(', ');

  const stats = {
    cr: monster.cr,
    xp: monster.xp,
    type: monster.type,
    alignment: monster.alignment,
    ac: monster.ac,
    acNote: monster.acNote,
    hp: monster.hp,
    hpDice: monster.hpDice,
    speed: monster.speed,
    abilityScores: monster.abilityScores,
    savingThrows: monster.savingThrows,
    skills: monster.skills,
    damageResistances: monster.damageResistances,
    damageImmunities: monster.damageImmunities,
    conditionImmunities: monster.conditionImmunities,
    senses: monster.senses,
    languages: monster.languages,
    traits: monster.traits ?? [],
    actions: monster.actions,
    legendaryActions: monster.legendaryActions ?? [],
    reactions: monster.reactions ?? [],
    ddbId: monster.ddbId,
    sourceUrl: monster.sourceUrl,
  };

  return {
    name: monster.name,
    description,
    faction: monster.type,
    role: `CR ${monster.cr}`,
    tags: ['ddb-import', monster.type, `cr-${monster.cr}`].filter(Boolean),
    stats,
  };
}
