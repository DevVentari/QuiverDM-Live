import { BrainInsightsPanel } from './brain-insights-panel';

interface SidebarRow { label: string; value: string | number | undefined | null }

function SidebarCard({ title, rows }: { title?: string; rows: SidebarRow[] }) {
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (!visible.length) return null;
  return (
    <div className="bg-white/[0.04] border border-border/30 rounded-md p-3 space-y-2">
      {title && <p className="text-[9px] uppercase tracking-widest text-amber-400/60">{title}</p>}
      {visible.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[10px] text-muted-foreground/60">{label}</p>
          <p className="text-sm text-foreground/90">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InfluenceBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const label = score >= 8 ? 'Dominant' : score >= 5 ? 'Significant' : score >= 3 ? 'Minor' : 'Fringe';
  return (
    <div>
      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-1">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground/60">{score.toFixed(1)} / 10 — {label}</p>
    </div>
  );
}

type WorldEntry = {
  type: string;
  structuredData: Record<string, unknown> | null;
  worldEntity: ({
    confidence: number;
    sessionAppearances: Array<{ session: { id: string; sessionNumber: number; title: string | null } | null }>;
  }) | null;
};

export function EntitySidebar({ entry }: { entry: WorldEntry }) {
  const d = (entry.structuredData ?? {}) as Record<string, unknown>;

  const sidebar = (() => {
    switch (entry.type) {
      case 'LOCATION':
        return (
          <SidebarCard title="Key Info" rows={[
            { label: 'Population', value: d.population as string },
            { label: 'Government', value: d.government as string },
            { label: 'Defenses', value: d.defenses as string },
            { label: 'Commerce', value: d.commerce as string },
          ]} />
        );
      case 'MONSTER':
        return (
          <SidebarCard title="Stats" rows={[
            { label: 'Size / Type', value: [d.size, d.type].filter(Boolean).join(' ') },
            { label: 'Alignment', value: d.alignment as string },
            { label: 'Senses', value: d.senses as string },
          ]} />
        );
      case 'NPC':
      case 'PC':
        return (
          <SidebarCard title="Quick Info" rows={[
            { label: 'Role', value: (d.role ?? d.type_alignment) as string },
            { label: 'Faction', value: d.faction as string },
          ]} />
        );
      case 'ITEM':
        return (
          <SidebarCard title="Item Info" rows={[
            { label: 'Type', value: d.itemType as string },
            { label: 'Damage', value: d.damage as string },
            { label: 'Rarity', value: typeof d.rarity === 'string' ? d.rarity.charAt(0).toUpperCase() + d.rarity.slice(1) : undefined },
            { label: 'Attunement', value: d.requiresAttunement ? 'Required' : 'Not required' },
          ]} />
        );
      case 'FACTION':
        return (
          <div className="space-y-3">
            {typeof d.influenceScore === 'number' && (
              <div className="bg-white/[0.04] border border-border/30 rounded-md p-3">
                <p className="text-[9px] uppercase tracking-widest text-amber-400/60 mb-2">Influence</p>
                <InfluenceBar score={d.influenceScore} />
              </div>
            )}
            <SidebarCard rows={[
              { label: 'Headquarters', value: d.headquarters as string },
              { label: 'Alignment', value: d.alignment as string },
            ]} />
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-3">
      {sidebar}
      {entry.worldEntity && <BrainInsightsPanel entity={entry.worldEntity} />}
    </div>
  );
}
