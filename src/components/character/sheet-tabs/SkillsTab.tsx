import { DndIcon, SKILL_ICONS } from '@/components/ui/dnd-icon';
import { abilityMod, fmt, type CharacterSheetData, type AbilityKey } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface SkillsTabProps {
  char: CharacterSheetData;
}

export function SkillsTab({ char }: SkillsTabProps) {
  const abilities = char.abilityScores;
  const profBonus = char.proficiencyBonus ?? 2;
  const skills = char.proficiencies?.skills ?? [];

  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground/50 italic">No skill data available.</p>;
  }

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <OverlineLabel>Skills</OverlineLabel>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0">
        {sorted.map((skill) => {
          const score = abilities?.[skill.ability as AbilityKey] ?? 10;
          const base = abilityMod(score);
          let total = base;
          if (skill.proficient) total += profBonus;
          if (skill.expertise) total += profBonus;
          return (
            <div key={skill.name} className="flex items-center gap-1.5 py-[3px]">
              <div
                className={`h-2 w-2 rounded-full border shrink-0 ${
                  skill.expertise
                    ? 'bg-amber-500 border-amber-500 ring-1 ring-amber-500/30'
                    : skill.proficient
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-muted-foreground/30'
                }`}
              />
              <span className="font-mono w-6 text-right text-xs tabular-nums font-semibold shrink-0 text-primary">
                {fmt(total)}
              </span>
              {SKILL_ICONS[skill.name] && (
                <DndIcon name={SKILL_ICONS[skill.name]} className="h-3 w-3 opacity-50 shrink-0" />
              )}
              <span
                className={`text-xs truncate ${
                  skill.proficient ? 'text-foreground' : 'text-muted-foreground/60'
                }`}
              >
                {skill.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
