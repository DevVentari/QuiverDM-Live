import { type CharacterSheetData, type CharSpell } from '../sheet-utils';

function OverlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-600/70 mb-2">{children}</p>
  );
}

interface SpellsTabProps {
  char: CharacterSheetData;
}

export function SpellsTab({ char }: SpellsTabProps) {
  const spellcasting = char.spellcasting;
  if (!spellcasting) {
    return <p className="text-sm text-muted-foreground/50 italic">No spellcasting data available.</p>;
  }

  const slots = spellcasting.slots ?? {};
  const spells = spellcasting.spells ?? [];

  const byLevel = spells.reduce<Record<number, CharSpell[]>>((acc, spell) => {
    const lvl = spell.level ?? 0;
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(spell);
    return acc;
  }, {});

  const levels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {/* Spell slots */}
      {Object.keys(slots).length > 0 && (
        <div>
          <OverlineLabel>Spell Slots</OverlineLabel>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
              const slot = slots[lvl] ?? slots[String(lvl)];
              if (!slot) return null;
              const used = slot.used ?? 0;
              const total = slot.total ?? 0;
              const remaining = total - used;
              return (
                <div
                  key={lvl}
                  className={`flex flex-col items-center rounded border px-3 py-1.5 ${
                    remaining === 0
                      ? 'border-muted/20 bg-muted/5 opacity-40'
                      : 'border-amber-800/25 bg-amber-950/15'
                  }`}
                >
                  <span className="text-sm font-bold tabular-nums">{remaining}/{total}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
                    Lvl {lvl}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spell list */}
      {levels.map((lvl) => (
        <div key={lvl}>
          <OverlineLabel>{lvl === 0 ? 'Cantrips' : `Level ${lvl}`}</OverlineLabel>
          <div className="space-y-1">
            {(byLevel[lvl] ?? []).map((spell) => (
              <div
                key={spell.name}
                className="flex items-center gap-2 rounded border border-border/30 px-3 py-1.5"
              >
                <span className="flex-1 text-sm font-medium truncate">{spell.name}</span>
                {spell.concentration && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600/60 shrink-0">
                    Conc
                  </span>
                )}
                {spell.damage && (
                  <span className="text-xs text-muted-foreground shrink-0">{spell.damage}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {levels.length === 0 && (
        <p className="text-sm text-muted-foreground/50 italic">No spells known.</p>
      )}
    </div>
  );
}
