import { DndIcon, DAMAGE_ICONS } from '@/components/ui/dnd-icon';
import { fmt, type CharacterSheetData, computeWeaponAttacks, computeSpellStats } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface CombatTabProps {
  char: CharacterSheetData;
}

export function CombatTab({ char }: CombatTabProps) {
  const abilities = char.abilityScores;
  const profBonus = char.proficiencyBonus ?? 2;
  const weaponAttacks = computeWeaponAttacks(char.inventory, abilities, profBonus);
  const { spellSaveDC, spellAttackBonus } = computeSpellStats(char.spellcasting, abilities, profBonus);

  const attackCantrips = (char.spellcasting?.spells ?? [])
    .filter((s) => s.level === 0 && s.damage)
    .map((s) => ({ name: s.name, damage: s.damage as string, school: s.school }));

  const hasAttacks = weaponAttacks.length > 0 || attackCantrips.length > 0;

  return (
    <div className="space-y-5">
      {(spellSaveDC != null || spellAttackBonus != null) && (
        <div>
          <OverlineLabel>Spellcasting</OverlineLabel>
          <div className="flex gap-2">
            {spellSaveDC != null && (
              <div className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-2 px-4">
                <span className="text-base font-bold tabular-nums">{spellSaveDC}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">Spell Save DC</span>
              </div>
            )}
            {spellAttackBonus != null && (
              <div className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-2 px-4">
                <span className="text-base font-bold tabular-nums">{fmt(spellAttackBonus)}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">Spell Attack</span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasAttacks && (
        <div>
          <OverlineLabel>Attacks</OverlineLabel>
          <div className="space-y-1.5">
            {weaponAttacks.map((atk) => (
              <div
                key={atk.name}
                className="flex items-center gap-3 rounded border border-border/40 px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium truncate">{atk.name}</span>
                <span className="font-mono text-sm font-bold text-primary shrink-0">
                  {atk.attackBonus >= 0 ? `+${atk.attackBonus}` : atk.attackBonus}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  {atk.damage}
                  {atk.damageType && DAMAGE_ICONS[atk.damageType.toLowerCase()] && (
                    <DndIcon
                      name={DAMAGE_ICONS[atk.damageType.toLowerCase()]}
                      className="h-3.5 w-3.5 opacity-70"
                    />
                  )}
                  {atk.damageType && !DAMAGE_ICONS[atk.damageType.toLowerCase()] && ` ${atk.damageType}`}
                </span>
              </div>
            ))}
            {attackCantrips.map((spell) => (
              <div
                key={spell.name}
                className="flex items-center gap-3 rounded border border-border/40 px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium truncate">{spell.name}</span>
                <span className="text-xs text-muted-foreground/60 shrink-0 italic">cantrip</span>
                <span className="text-xs text-muted-foreground shrink-0">{spell.damage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAttacks && spellSaveDC == null && (
        <p className="text-sm text-muted-foreground/50 italic">No attack data available.</p>
      )}
    </div>
  );
}
