'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dices, Swords, ChevronRight } from 'lucide-react';
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
  const [localSpellSlots, setLocalSpellSlots] = useState<
    Record<string, { total: number; used: number }>
  >(spellSlots ?? {});

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

  const [actionMode, setActionMode] = useState<'attacks' | 'spells'>('attacks');
  const [featActionsOpen, setFeatActionsOpen] = useState(false);

  useEffect(() => {
    setLocalSpellSlots(spellSlots ?? {});
  }, [spellSlots]);

  function detectActionType(description: string): string | null {
    const text = (description ?? '').toLowerCase();
    if (text.includes('as a reaction') || text.includes('as your reaction')) return 'Reaction';
    if (text.includes('bonus action')) return 'Bonus Action';
    if (text.includes('as an action') || text.includes('use your action') || text.includes('using your action')) return 'Action';
    return null;
  }

  const allFeatures = (data.features as any[] | null) ?? [];
  const featActions = allFeatures
    .map((f: any) => ({ ...f, actionType: detectActionType(f.description ?? '') }))
    .filter((f: any) => f.actionType !== null);

  function quickSummary(entry: { actionType?: string | null; castingTime?: string | null; range?: string | null; damage?: string | null; savingThrow?: string | null; school?: string | null }) {
    if (entry.actionType) return entry.actionType;
    if (entry.castingTime) return entry.castingTime;
    if (entry.damage) return entry.damage;
    if (entry.savingThrow) return `${entry.savingThrow} save`;
    if (entry.range) return entry.range;
    if (entry.school) return entry.school;
    return 'Action';
  }

  const allSpells = (spellcasting?.spells as any[] | null) ?? [];
  const spellsByLevel: Record<number, any[]> = {};
  for (const spell of allSpells) {
    const lvl = spell.level ?? 0;
    if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
    spellsByLevel[lvl].push(spell);
  }
  const spellLevelsSorted = Object.keys(spellsByLevel).map(Number).sort((a, b) => a - b);

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

      {/* ── Quick Actions ───────────────────────────────────────── */}
      {(weaponAttacks.length > 0 || attackCantrips.length > 0 || allSpells.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setActionMode('attacks')}
                  className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                    actionMode === 'attacks'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Attacks
                </button>
                <button
                  type="button"
                  onClick={() => setActionMode('spells')}
                  className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                    actionMode === 'spells'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Spells
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {actionMode === 'attacks' && (
              <>
                {weaponAttacks.length === 0 && attackCantrips.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">No attacks equipped</p>
                )}
                {weaponAttacks.map((attack: any) => (
                  <div key={attack.name} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{attack.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {attack.damage}{attack.damageType ? ` ${attack.damageType}` : ''}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRoll?.(`1d20${attack.attackBonus >= 0 ? `+${attack.attackBonus}` : attack.attackBonus}`, `${attack.name} Attack`)}
                        className="text-xs rounded border border-border/60 px-2 py-0.5 font-mono font-bold text-primary hover:bg-muted hover:border-primary/40 transition-colors"
                      >
                        {attack.attackBonus >= 0 ? `+${attack.attackBonus}` : attack.attackBonus}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const notation = String(attack.damage).replace(/\s+/g, '');
                          const match = notation.match(/^\d+d\d+([+-]\d+)?/i);
                          if (match) onRoll?.(match[0], `${attack.name} Damage`);
                        }}
                        className="text-xs rounded border border-border/60 px-2 py-0.5 hover:bg-muted transition-colors"
                      >
                        Dmg
                      </button>
                    </div>
                  </div>
                ))}
                {attackCantrips.map((spell: any) => (
                  <div key={spell.name} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{spell.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {spell.damage || (spell.savingThrow ? `${spell.savingThrow} save` : 'Cantrip')}
                      </span>
                    </div>
                    {onRoll && spell.damage && (
                      <button
                        type="button"
                        onClick={() => {
                          const match = String(spell.damage).match(/(\d+d\d+([+-]\d+)?)/i);
                          if (match) onRoll(match[1], `${spell.name} Damage`);
                        }}
                        className="text-xs rounded border border-border/60 px-2 py-0.5 hover:bg-muted transition-colors shrink-0"
                      >
                        Dmg
                      </button>
                    )}
                  </div>
                ))}

                {/* Feat & Class Actions */}
                {featActions.length > 0 && (
                  <div className="border-t border-border/50 pt-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setFeatActionsOpen(!featActionsOpen)}
                      className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${featActionsOpen ? 'rotate-90' : ''}`} />
                      Feat & Class Actions ({featActions.length})
                    </button>
                    {featActionsOpen && (
                      <div className="mt-1.5 space-y-1">
                        {featActions.map((feat: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-1.5 text-sm">
                            <span className="flex-1 min-w-0 truncate">{feat.name}</span>
                            <span className="text-[11px] text-muted-foreground/80 hidden sm:inline truncate max-w-[11rem] text-right">
                              {quickSummary({ actionType: feat.actionType })}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0 font-normal">
                              {feat.actionType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {actionMode === 'spells' && (
              <>
                {allSpells.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No spells available</p>
                ) : (
                  spellLevelsSorted.map((level) => (
                    <div key={level}>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 mt-2 first:mt-0 flex items-center gap-2 flex-wrap">
                        {level === 0 ? 'Cantrips' : `Level ${level}`}
                        {level > 0 && localSpellSlots?.[`level${level}`] && (() => {
                          const key = `level${level}`;
                          const slot = localSpellSlots[key];
                          return (
                            <SpellSlotPips
                              total={slot.total}
                              used={slot.used}
                              disabled={isUpdating}
                              onChangeUsed={async (nextUsed) => {
                                const nextSlots = { ...localSpellSlots, [key]: { ...slot, used: nextUsed } };
                                setLocalSpellSlots(nextSlots);
                                await onUpdate?.({ spellcasting: { ...(spellcasting ?? {}), slots: nextSlots } });
                              }}
                            />
                          );
                        })()}
                      </div>
                      {spellsByLevel[level]
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                        .map((spell: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm mb-1">
                            <div className="flex-1 min-w-0">
                              <span className={`font-medium ${!spell.prepared && !spell.alwaysPrepared && spell.level > 0 ? 'text-muted-foreground' : ''}`}>
                                {spell.name}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {quickSummary({
                                  castingTime: spell.castingTime,
                                  damage: spell.damage,
                                  savingThrow: spell.savingThrow,
                                  range: spell.range,
                                  school: spell.school,
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {spell.concentration && <span className="text-[10px] text-amber-500/70 font-bold" title="Concentration">C</span>}
                              {spell.ritual && <span className="text-[10px] text-muted-foreground/60 font-bold" title="Ritual">R</span>}
                              {onRoll && spell.damage && (() => {
                                const match = String(spell.damage).match(/(\d+d\d+([+-]\d+)?)/i);
                                return match ? (
                                  <button
                                    type="button"
                                    className="text-xs rounded border border-border/60 px-2 py-0.5 hover:bg-muted transition-colors"
                                    onClick={() => onRoll(match[1], `${spell.name} Damage`)}
                                  >
                                    Dmg
                                  </button>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

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

                {Object.keys(localSpellSlots).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(localSpellSlots).map(([key, slot]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{key.replace('level', 'Level ')}</span>
                        <SpellSlotPips
                          total={slot.total}
                          used={slot.used}
                          disabled={isUpdating}
                          onChangeUsed={async (nextUsed) => {
                            const nextSlots = {
                              ...localSpellSlots,
                              [key]: {
                                ...slot,
                                used: nextUsed,
                              },
                            };
                            setLocalSpellSlots(nextSlots);
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
