
interface AbilityScores {
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
}
interface MonsterData {
  ac?: number; acNote?: string;
  hp?: number; hpNote?: string;
  speed?: string;
  size?: string; type?: string; alignment?: string;
  abilityScores?: AbilityScores;
  cr?: string; xp?: number;
  resistances?: string[]; immunities?: string[];
  conditionImmunities?: string[]; senses?: string;
  traits?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string }>;
  reactions?: Array<{ name: string; description: string }>;
  legendaryActions?: Array<{ name: string; description: string }>;
}

function mod(score: number) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function AbilityBox({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-amber-400/70">{label}</span>
      <span className="text-base font-bold text-foreground">{score}</span>
      <span className="text-[10px] text-muted-foreground">{mod(score)}</span>
    </div>
  );
}

function BlockEntry({ name, description }: { name: string; description: string }) {
  return (
    <div className="bg-white/[0.03] rounded px-3 py-2 text-sm">
      <span className="font-semibold text-foreground/80">{name}. </span>
      <span className="text-muted-foreground leading-relaxed">{description}</span>
    </div>
  );
}

export function MonsterStatBlock({ data }: { data: MonsterData }) {
  const { abilityScores: ab } = data;
  return (
    <div className="space-y-4">
      {(data.size || data.type || data.alignment) && (
        <p className="text-sm italic text-muted-foreground">
          {[data.size, data.type, data.alignment].filter(Boolean).join(' ')}
        </p>
      )}

      <div className="flex flex-wrap gap-6 text-sm border-y border-amber-500/20 py-3">
        {data.ac != null && (
          <div>
            <span className="text-amber-400/70 text-[10px] uppercase tracking-widest block">AC</span>
            <span className="font-semibold">{data.ac}{data.acNote ? ` (${data.acNote})` : ''}</span>
          </div>
        )}
        {data.hp != null && (
          <div>
            <span className="text-amber-400/70 text-[10px] uppercase tracking-widest block">HP</span>
            <span className="font-semibold">{data.hp}{data.hpNote ? ` (${data.hpNote})` : ''}</span>
          </div>
        )}
        {data.speed && (
          <div>
            <span className="text-amber-400/70 text-[10px] uppercase tracking-widest block">Speed</span>
            <span className="font-semibold">{data.speed}</span>
          </div>
        )}
        {data.cr && (
          <div>
            <span className="text-amber-400/70 text-[10px] uppercase tracking-widest block">CR</span>
            <span className="font-semibold">{data.cr}{data.xp ? ` (${data.xp.toLocaleString()} XP)` : ''}</span>
          </div>
        )}
      </div>

      {ab && (
        <div className="grid grid-cols-6 gap-2 bg-black/20 rounded-md p-3">
          <AbilityBox label="STR" score={ab.str} />
          <AbilityBox label="DEX" score={ab.dex} />
          <AbilityBox label="CON" score={ab.con} />
          <AbilityBox label="INT" score={ab.int} />
          <AbilityBox label="WIS" score={ab.wis} />
          <AbilityBox label="CHA" score={ab.cha} />
        </div>
      )}

      {[
        { label: 'Damage Resistances', items: data.resistances },
        { label: 'Damage Immunities', items: data.immunities },
        { label: 'Condition Immunities', items: data.conditionImmunities },
      ].filter(({ items }) => items?.length).map(({ label, items }) => (
        <div key={label} className="text-sm">
          <span className="font-semibold text-foreground/80">{label}. </span>
          <span className="text-muted-foreground">{items!.join(', ')}</span>
        </div>
      ))}
      {data.senses && (
        <div className="text-sm">
          <span className="font-semibold text-foreground/80">Senses. </span>
          <span className="text-muted-foreground">{data.senses}</span>
        </div>
      )}

      {data.traits && data.traits.length > 0 && (
        <div className="space-y-1.5">
          {data.traits.map((t) => <BlockEntry key={t.name} {...t} />)}
        </div>
      )}

      {data.actions && data.actions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-amber-400/70 border-t border-amber-500/20 pt-3">Actions</p>
          {data.actions.map((a) => <BlockEntry key={a.name} {...a} />)}
        </div>
      )}

      {data.reactions && data.reactions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-amber-400/70 border-t border-amber-500/20 pt-3">Reactions</p>
          {data.reactions.map((r) => <BlockEntry key={r.name} {...r} />)}
        </div>
      )}

      {data.legendaryActions && data.legendaryActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-widest text-amber-400/70 border-t border-amber-500/20 pt-3">Legendary Actions</p>
          {data.legendaryActions.map((la) => <BlockEntry key={la.name} {...la} />)}
        </div>
      )}
    </div>
  );
}
