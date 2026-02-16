'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DiceRoll } from '@/lib/dice';

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

type CharacterProficienciesProps = {
  data: any;
  onRoll?: (notation: string, label?: string) => DiceRoll;
};

export function CharacterProficiencies({ data, onRoll }: CharacterProficienciesProps) {
  const proficiencies = data.proficiencies as any;
  const abilities = data.abilityScores as any;
  const profBonus = data.proficiencyBonus ?? 2;

  if (!proficiencies) {
    return <div className="text-center py-12 text-muted-foreground">No proficiency data available</div>;
  }

  const skills = proficiencies.skills as any[] | undefined;
  const tools = proficiencies.tools as string[] | undefined;
  const weapons = proficiencies.weapons as string[] | undefined;
  const armor = proficiencies.armor as string[] | undefined;

  return (
    <div className="space-y-4">
      {skills && skills.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
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
                    className={`flex w-full items-center gap-2 py-[3px] border-b border-border/50 last:border-0 ${
                      onRoll ? 'cursor-pointer hover:bg-muted/40 rounded px-1' : ''
                    }`}
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                        skill.expertise
                          ? 'bg-primary border-primary ring-2 ring-primary/30'
                          : skill.proficient
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/40'
                      }`}
                    />
                    <span className="font-mono w-7 text-right text-xs tabular-nums font-semibold shrink-0">
                      {formatModifier(totalMod)}
                    </span>
                    <span className={`text-sm truncate ${skill.proficient ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {skill.name}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground/60 ml-auto shrink-0">
                      {skill.ability}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {tools && tools.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {weapons && weapons.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Weapons
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {weapons.map((w) => (
                  <Badge key={w} variant="outline" className="text-xs">
                    {w}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {armor && armor.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Armor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {armor.map((a) => (
                  <Badge key={a} variant="outline" className="text-xs">
                    {a}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

