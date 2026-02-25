'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Zap, Star, Dices, Swords } from 'lucide-react';
import { HPTracker } from '@/components/character/HPTracker';
import { SpellSlotPips } from '@/components/character/SpellSlotPips';
import { DeathSaves, type DeathSavesValue } from '@/components/character/DeathSaves';
import type { DiceRoll } from '@/lib/dice';

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function rollableClass() {
  return 'cursor-pointer transition-colors hover:bg-muted/40 rounded';
}

type CharacterOverviewProps = {
  data: any;
  onUpdate?: (patch: any) => Promise<void>;
  onRoll?: (notation: string, label?: string) => DiceRoll;
  isUpdating?: boolean;
};

export function CharacterOverview({
  data,
  onUpdate,
  onRoll,
  isUpdating,
}: CharacterOverviewProps) {
  const hp = (data.hitPoints as any) ?? null;
  const abilities = data.abilityScores as any;
  const saves = data.savingThrows as any;
  const senses = data.senses as any;
  const languages = data.languages as string[] | null;
  const resistances = data.resistances as any;
  const hitDice = (data.hitDice as any[] | null) ?? [];
  const profBonus = data.proficiencyBonus ?? 2;

  const proficiencies = data.proficiencies as any;
  const skills = proficiencies?.skills as any[] | undefined;

  const rawChar = (data.rawData as any)?.data;
  const xp = rawChar?.currentXp ?? null;
  const inspiration = rawChar?.inspiration ?? false;
  const conditions = rawChar?.conditions as any[] | null;

  const spellcasting = data.spellcasting as any;
  const inventory = (data.inventory as any[] | null) ?? [];
  const spellSlots = spellcasting?.slots as Record<string, { total: number; used: number }> | undefined;

  const initMod = abilities ? abilityModifier(abilities.dex ?? 10) : 0;

  const getSkillMod = (skillName: string): number => {
    const skill = skills?.find((s: any) => s.name === skillName);
    if (!skill || !abilities) return 0;
    const abilityScore = abilities[skill.ability] ?? 10;
    let mod = abilityModifier(abilityScore);
    if (skill.proficient) mod += profBonus;
    if (skill.expertise) mod += profBonus;
    return mod;
  };

  const passivePerception = 10 + getSkillMod('Perception');
  const passiveInvestigation = 10 + getSkillMod('Investigation');
  const passiveInsight = 10 + getSkillMod('Insight');

  const spellAbility = spellcasting?.ability as string | null;
  const spellAbilityMod =
    spellAbility && abilities ? abilityModifier(abilities[spellAbility] ?? 10) : null;
  const spellSaveDC = spellAbilityMod != null ? 8 + profBonus + spellAbilityMod : null;
  const spellAttackBonus = spellAbilityMod != null ? profBonus + spellAbilityMod : null;

  const deathSaves: DeathSavesValue = (data.features as any)?._quiver?.deathSaves ?? {
    successes: 0,
    failures: 0,
  };

  const weaponAttacks = inventory
    .filter((item: any) => item.equipped && item.damage)
    .map((item: any) => {
      const strMod = abilities ? abilityModifier(abilities.str ?? 10) : 0;
      const dexMod = abilities ? abilityModifier(abilities.dex ?? 10) : 0;
      const isRanged = item.attackType === 'Ranged';
      const isFinesse = (item.properties || []).some(
        (p: string) => p.toLowerCase() === 'finesse'
      );
      const abilityMod = isRanged ? dexMod : isFinesse ? Math.max(strMod, dexMod) : strMod;
      const magic = item.magicBonus || 0;
      const attackBonus = abilityMod + profBonus + magic;
      const damageBonus = abilityMod + magic;
      return {
        name: item.name,
        attackBonus,
        damage: item.damage + (damageBonus !== 0 ? `${damageBonus >= 0 ? '+' : ''}${damageBonus}` : ''),
        damageType: item.damageType,
      };
    });

  const attackCantrips = (spellcasting?.spells || [])
    .filter((s: any) => s.level === 0 && (s.damage || s.savingThrow))
    .map((s: any) => ({
      name: s.name,
      damage: s.damage || null,
      savingThrow: s.savingThrow || null,
    }));

  return (
    <div className="space-y-4">
      {(inspiration || xp != null || (conditions && conditions.length > 0)) && (
        <div className="flex flex-wrap gap-2">
          {inspiration && <Badge variant="default">Inspired</Badge>}
          {xp != null && <Badge variant="outline">XP: {xp.toLocaleString()}</Badge>}
          {conditions?.map((c: any, i: number) => (
            <Badge key={i} variant="destructive">
              {c.name || c.definition?.name || 'Unknown Condition'}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          {abilities && (
            <Card>
              <CardContent className="pt-4 pb-6 px-4">
                <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((key) => {
                    const score = abilities[key] ?? 10;
                    const mod = abilityModifier(score);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => onRoll?.(`1d20${mod >= 0 ? `+${mod}` : mod}`, `${key.toUpperCase()} Check`)}
                        className={`relative flex flex-col items-center rounded-lg border-2 border-border px-2 pt-1.5 pb-5 transition-colors hover:border-primary/40 ${onRoll ? rollableClass() : ''}`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {key}
                        </span>
                        <span className="text-xl font-bold leading-tight tabular-nums">{score}</span>
                        <div className="absolute -bottom-3 flex h-6 min-w-[2.5rem] items-center justify-center rounded-full border-2 border-primary/50 bg-card text-sm font-bold tabular-nums text-primary">
                          {formatModifier(mod)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {saves && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Saving Throws
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((key) => {
                    const val = saves[key];
                    if (!val) return null;
                    const score = abilities?.[key] ?? 10;
                    const mod = abilityModifier(score) + (val.proficient ? profBonus : 0);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onRoll?.(`1d20${mod >= 0 ? `+${mod}` : mod}`, `${key.toUpperCase()} Save`)}
                        className={`w-full flex items-center gap-2 text-sm px-1 py-0.5 ${onRoll ? rollableClass() : ''}`}
                      >
                        <div
                          className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                            val.proficient ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                          }`}
                        />
                        <span className="font-mono w-7 text-right text-xs tabular-nums font-semibold">
                          {formatModifier(mod)}
                        </span>
                        <span className="uppercase text-xs text-muted-foreground tracking-wide">{key}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {skills && skills.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-0">
                  {skills.map((skill: any) => {
                    const abilityScore = abilities?.[skill.ability] ?? 10;
                    const abilityMod = abilityModifier(abilityScore);
                    let totalMod = abilityMod;
                    if (skill.proficient) totalMod += profBonus;
                    if (skill.expertise) totalMod += profBonus;
                    return (
                      <button
                        key={skill.name}
                        type="button"
                        onClick={() =>
                          onRoll?.(`1d20${totalMod >= 0 ? `+${totalMod}` : totalMod}`, `${skill.name} Check`)
                        }
                        className={`w-full flex items-center gap-1.5 py-[2px] px-1 ${onRoll ? rollableClass() : ''}`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full border shrink-0 ${
                            skill.expertise
                              ? 'bg-primary border-primary ring-2 ring-primary/30'
                              : skill.proficient
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/40'
                          }`}
                        />
                        <span className="font-mono w-6 text-right text-[11px] tabular-nums font-semibold shrink-0">
                          {formatModifier(totalMod)}
                        </span>
                        <span className={`text-[11px] truncate ${skill.proficient ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {skill.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {hitDice.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Hit Dice
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-2">
                  {hitDice.map((hd: any, i: number) => {
                    const remaining = hd.total - (hd.used || 0);
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs font-mono">
                          {hd.die}
                        </Badge>
                        <SpellSlotPips
                          total={hd.total}
                          used={hd.used || 0}
                          disabled={isUpdating}
                          pipClassName="rounded-sm"
                          onChangeUsed={async (nextUsed) => {
                            if (!onUpdate) return;
                            const next = hitDice.map((entry: any, idx: number) =>
                              idx === i ? { ...entry, used: nextUsed } : entry
                            );
                            await onUpdate({ hitDice: next });
                          }}
                        />
                        <button
                          type="button"
                          className={`ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground ${onRoll ? 'hover:text-foreground' : ''}`}
                          onClick={() => {
                            const dieSides = Number(String(hd.die ?? '').replace(/[^\d]/g, '')) || 0;
                            const conMod = abilityModifier(abilities?.con ?? 10);
                            if (dieSides > 0) {
                              onRoll?.(
                                `1d${dieSides}${conMod === 0 ? '' : conMod > 0 ? `+${conMod}` : `${conMod}`}`,
                                `Hit Die (${hd.die})`
                              );
                            }
                          }}
                        >
                          <Dices className="h-3 w-3" />
                          {remaining}/{hd.total}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {hp && (
              <Card className="col-span-2">
                <CardContent className="pt-3 pb-3 px-4">
                  <HPTracker
                    value={hp}
                    disabled={isUpdating}
                    onApply={async (next) => {
                      await onUpdate?.({ hitPoints: next });
                    }}
                  />
                  <Progress value={hp.max > 0 ? (hp.current / hp.max) * 100 : 0} className="h-2 mt-1.5" />
                </CardContent>
              </Card>
            )}

            {data.armorClass != null && (
              <Card>
                <CardContent className="pt-3 pb-3 px-4 text-center">
                  <Shield className="h-4 w-4 mx-auto text-blue-400 mb-0.5" />
                  <div className="text-3xl font-bold tabular-nums text-primary">{data.armorClass}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Armor Class
                  </div>
                </CardContent>
              </Card>
            )}

            {data.speed != null && (
              <Card>
                <CardContent className="pt-3 pb-3 px-4 text-center">
                  <Zap className="h-4 w-4 mx-auto text-yellow-500 mb-0.5" />
                  <div className="text-3xl font-bold tabular-nums text-primary">{data.speed}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Speed (ft)</div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-3 pb-3 px-4 text-center">
                <Star className="h-4 w-4 mx-auto text-primary mb-0.5" />
                <div className="text-3xl font-bold tabular-nums text-primary">+{profBonus}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proficiency</div>
              </CardContent>
            </Card>

            {abilities && (
              <Card>
                <CardContent className="pt-3 pb-3 px-4 text-center">
                  <button
                    type="button"
                    className={`w-full ${onRoll ? rollableClass() : ''}`}
                    onClick={() => onRoll?.(`1d20${initMod >= 0 ? `+${initMod}` : initMod}`, 'Initiative')}
                  >
                    <div className="h-4 mb-0.5" />
                    <div className="text-3xl font-bold tabular-nums text-primary">{formatModifier(initMod)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Initiative</div>
                  </button>
                </CardContent>
              </Card>
            )}
          </div>

          {hp?.current === 0 && (
            <DeathSaves
              value={deathSaves}
              disabled={isUpdating}
              onChange={async (next) => {
                const nextFeatures = { ...(data.features ?? {}) };
                nextFeatures._quiver = { ...(nextFeatures._quiver ?? {}), deathSaves: next };
                await onUpdate?.({ features: nextFeatures });
              }}
            />
          )}

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-2 pb-2 px-3 text-center">
                <div className="text-xl font-bold tabular-nums">{passivePerception}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                  Passive Perception
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-2 pb-2 px-3 text-center">
                <div className="text-xl font-bold tabular-nums">{passiveInvestigation}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                  Passive Investigation
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-2 pb-2 px-3 text-center">
                <div className="text-xl font-bold tabular-nums">{passiveInsight}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">
                  Passive Insight
                </div>
              </CardContent>
            </Card>
          </div>

          {(spellSaveDC != null || spellAttackBonus != null) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display tracking-wide">Spellcasting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {spellSaveDC != null && (
                    <div className="rounded-md border p-2 text-center">
                      <div className="text-lg font-bold">{spellSaveDC}</div>
                      <div className="text-xs text-muted-foreground">Spell Save DC</div>
                    </div>
                  )}
                  {spellAttackBonus != null && (
                    <button
                      type="button"
                      onClick={() =>
                        onRoll?.(
                          `1d20${spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus}`,
                          'Spell Attack'
                        )
                      }
                      className={`rounded-md border p-2 text-center ${onRoll ? rollableClass() : ''}`}
                    >
                      <div className="text-lg font-bold">{formatModifier(spellAttackBonus)}</div>
                      <div className="text-xs text-muted-foreground">Spell Attack</div>
                    </button>
                  )}
                </div>

                {spellSlots && Object.keys(spellSlots).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(spellSlots).map(([key, slot]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{key.replace('level', 'Level ')}</span>
                        <SpellSlotPips
                          total={slot.total}
                          used={slot.used}
                          disabled={isUpdating}
                          onChangeUsed={async (nextUsed) => {
                            const nextSlots = {
                              ...spellSlots,
                              [key]: {
                                ...slot,
                                used: nextUsed,
                              },
                            };
                            await onUpdate?.({
                              spellcasting: {
                                ...(spellcasting ?? {}),
                                slots: nextSlots,
                              },
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(weaponAttacks.length > 0 || attackCantrips.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  Attacks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {weaponAttacks.map((attack: any) => (
                  <div key={attack.name} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <div className="text-sm font-medium">{attack.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {attack.damage} {attack.damageType ?? ''}
                      </div>
                    </div>
                    {onRoll && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-xs rounded border px-2 py-1 hover:bg-muted"
                          onClick={() =>
                            onRoll(
                              `1d20${attack.attackBonus >= 0 ? `+${attack.attackBonus}` : attack.attackBonus}`,
                              `${attack.name} Attack`
                            )
                          }
                        >
                          To Hit
                        </button>
                        <button
                          type="button"
                          className="text-xs rounded border px-2 py-1 hover:bg-muted"
                          onClick={() => {
                            const notation = String(attack.damage).replace(/\s+/g, '');
                            const match = notation.match(/^\d+d\d+([+-]\d+)?/i);
                            if (match) onRoll(match[0], `${attack.name} Damage`);
                          }}
                        >
                          Damage
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {attackCantrips.map((spell: any) => (
                  <div key={spell.name} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <div className="text-sm font-medium">{spell.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {spell.damage || (spell.savingThrow ? `${spell.savingThrow} save` : 'Attack cantrip')}
                      </div>
                    </div>
                    {onRoll && spell.damage && (
                      <button
                        type="button"
                        className="text-xs rounded border px-2 py-1 hover:bg-muted"
                        onClick={() => {
                          const match = String(spell.damage).match(/(\d+d\d+([+-]\d+)?)/i);
                          if (match) onRoll(match[1], `${spell.name} Damage`);
                        }}
                      >
                        Damage
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(senses || languages || resistances) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Senses & Traits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {senses && (
                  <div>
                    <span className="font-medium">Senses:</span>{' '}
                    {Object.entries(senses)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(', ')}
                  </div>
                )}
                {languages && languages.length > 0 && (
                  <div>
                    <span className="font-medium">Languages:</span> {languages.join(', ')}
                  </div>
                )}
                {resistances && (
                  <div className="space-y-1">
                    {resistances.damage?.length > 0 && (
                      <div>
                        <span className="font-medium">Damage Resistances:</span>{' '}
                        {resistances.damage.join(', ')}
                      </div>
                    )}
                    {resistances.conditions?.length > 0 && (
                      <div>
                        <span className="font-medium">Condition Resistances:</span>{' '}
                        {resistances.conditions.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

