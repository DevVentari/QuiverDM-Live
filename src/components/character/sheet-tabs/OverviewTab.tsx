import { DndIcon, ABILITY_ICONS } from '@/components/ui/dnd-icon';
import { abilityMod, fmt, ABILITY_KEYS, type AbilityKey, type CharacterSheetData, computeSkillMod, computeSpellStats } from '../sheet-utils';

function Chip({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded border py-2 px-1 ${highlight ? 'border-red-900/40 bg-red-950/20' : 'border-amber-800/20 bg-amber-950/15'}`}>
      <span className={`text-base font-bold tabular-nums ${highlight ? 'text-red-400' : ''}`}>{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5 text-center">{label}</span>
    </div>
  );
}

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface OverviewTabProps {
  char: CharacterSheetData;
}

export function OverviewTab({ char }: OverviewTabProps) {
  const abilities = char.abilityScores;
  const hp = char.hitPoints;
  const saves = char.savingThrows;
  const profBonus = char.proficiencyBonus ?? 2;
  const skills = char.proficiencies?.skills;
  const { spellSaveDC, spellAttackBonus } = computeSpellStats(char.spellcasting, abilities, profBonus);
  const passivePerception = 10 + computeSkillMod('Perception', skills, abilities, profBonus);
  const initiative = abilities ? abilityMod(abilities.dex ?? 10) : null;

  const senses = char.senses;
  const languages = char.languages;
  const resistances = char.resistances;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          <div>
            <OverlineLabel>Vitals</OverlineLabel>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="col-span-2 flex flex-col items-center rounded border border-red-900/40 bg-red-950/20 py-2 px-1">
                <span className="text-base font-bold tabular-nums text-red-400">
                  {hp ? `${hp.current}/${hp.max}` : '—'}
                </span>
                {hp?.temp ? (
                  <span className="text-[9px] text-amber-400/70 tabular-nums">+{hp.temp} temp</span>
                ) : null}
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60 mt-0.5">HP</span>
              </div>
              <Chip label="AC" value={char.armorClass ?? '—'} />
              <Chip label="Speed" value={`${char.speed ?? 30}ft`} />
              <Chip label="Initiative" value={initiative != null ? fmt(initiative) : '—'} />
              <Chip label="Prof Bonus" value={fmt(profBonus)} />
              <Chip label="Passive Perc" value={passivePerception} />
              {spellSaveDC != null && <Chip label="Spell DC" value={spellSaveDC} />}
              {spellAttackBonus != null && <Chip label="Spell Atk" value={fmt(spellAttackBonus)} />}
            </div>
          </div>

          {abilities && (
            <div>
              <OverlineLabel>Ability Scores</OverlineLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {ABILITY_KEYS.map((key) => {
                  const score = abilities[key] ?? 10;
                  const mod = abilityMod(score);
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 pt-2 pb-1.5 px-1"
                    >
                      <DndIcon name={ABILITY_ICONS[key]} className="h-5 w-5 opacity-60 mb-0.5" />
                      <span className="text-base font-bold tabular-nums">{score}</span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{fmt(mod)}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/40 mt-0.5">
                        {key.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        {saves && (
          <div>
            <OverlineLabel>Saving Throws</OverlineLabel>
            <div className="space-y-1">
              {ABILITY_KEYS.map((key) => {
                const score = abilities?.[key] ?? 10;
                const base = abilityMod(score);
                const proficient = saves[key]?.proficient ?? false;
                const total = base + (proficient ? profBonus : 0);
                return (
                  <div key={key} className="flex items-center gap-2 py-0.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                        proficient ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground/30'
                      }`}
                    />
                    <DndIcon name={ABILITY_ICONS[key]} className="h-3.5 w-3.5 opacity-50 shrink-0" />
                    <span className={`flex-1 text-xs ${proficient ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                      {key.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs font-bold text-primary tabular-nums">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer: senses / languages / resistances */}
      {(senses || languages || resistances) && (
        <div className="border-t border-amber-800/20 pt-4 space-y-1.5 text-xs text-muted-foreground">
          {senses && Object.entries(senses).length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Senses </span>
              {Object.entries(senses).map(([k, v]) => `${k} ${v}`).join(', ')}
            </p>
          )}
          {languages && languages.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Languages </span>
              {languages.join(', ')}
            </p>
          )}
          {resistances?.damage && resistances.damage.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Resistances </span>
              {resistances.damage.join(', ')}
            </p>
          )}
          {resistances?.conditions && resistances.conditions.length > 0 && (
            <p>
              <span className="font-semibold text-foreground/60 uppercase text-[9px] tracking-wide">Immune </span>
              {resistances.conditions.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
