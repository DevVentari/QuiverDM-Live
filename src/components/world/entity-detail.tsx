'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, EyeOff } from 'lucide-react';
import { MonsterStatBlock } from './monster-stat-block';
import { EntitySidebar } from './entity-sidebar';
import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  LOCATION: 'text-emerald-400/80',
  NPC: 'text-blue-400/80',
  PC: 'text-violet-400/80',
  MONSTER: 'text-red-400/80',
  ITEM: 'text-yellow-400/80',
  FACTION: 'text-purple-400/80',
  RACE: 'text-pink-400/80',
  LORE: 'text-amber-400/80',
  TIMELINE: 'text-violet-400/80',
  SPELL: 'text-cyan-400/80',
};

const TYPE_LABELS: Record<string, string> = {
  LOCATION: 'Location', NPC: 'NPC', PC: 'Player Character',
  MONSTER: 'Monster', ITEM: 'Item', FACTION: 'Faction',
  RACE: 'Race', LORE: 'Lore', TIMELINE: 'Timeline', SPELL: 'Spell',
};

const RARITY_CLASSES: Record<string, string> = {
  common: 'text-muted-foreground border-border/30',
  uncommon: 'text-green-400 border-green-500/30',
  rare: 'text-blue-400 border-blue-500/30',
  'very rare': 'text-purple-400 border-purple-500/30',
  legendary: 'text-orange-400 border-orange-500/30',
  artifact: 'text-amber-400 border-amber-500/30',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-amber-400/70 border-t border-amber-500/20 pt-3 mt-3">
      {children}
    </p>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert
      prose-headings:font-display prose-headings:text-amber-200/90
      prose-p:text-muted-foreground prose-p:leading-relaxed
      prose-strong:text-foreground/80 prose-li:text-muted-foreground
      prose-table:text-sm prose-th:text-amber-300/70
      prose-hr:border-border/30">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

type EntryData = {
  id: string;
  type: string;
  name: string;
  slug: string;
  content: string;
  summary: string | null;
  tags: string[];
  structuredData: Record<string, unknown> | null;
  worldEntity: ({
    confidence: number;
    sessionAppearances: Array<{ session: { id: string; sessionNumber: number; title: string | null } | null }>;
  }) | null;
};

export function EntityDetail({ entry }: { entry: EntryData }) {
  const [secretsVisible, setSecretsVisible] = useState(false);
  const d = (entry.structuredData ?? {}) as Record<string, unknown>;
  const color = TYPE_COLORS[entry.type] ?? 'text-muted-foreground';
  const label = TYPE_LABELS[entry.type] ?? entry.type;
  const hasSidebar = !['LORE', 'TIMELINE', 'SPELL', 'RACE'].includes(entry.type);

  const mainContent = (() => {
    switch (entry.type) {
      case 'MONSTER':
        return (
          <>
            <MonsterStatBlock data={d as Parameters<typeof MonsterStatBlock>[0]['data']} />
            {entry.content && (
              <>
                <SectionLabel>Lore</SectionLabel>
                <MarkdownBody content={entry.content} />
              </>
            )}
          </>
        );

      case 'ITEM': {
        const rarity = typeof d.rarity === 'string' ? d.rarity : undefined;
        const rarityClass = rarity ? RARITY_CLASSES[rarity] ?? RARITY_CLASSES.common : '';
        return (
          <>
            {rarity && (
              <span className={cn('inline-block text-xs font-semibold border rounded px-2 py-0.5 mb-3', rarityClass)}>
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                {d.requiresAttunement ? ' · Requires Attunement' : ''}
                {d.tier === 'artifact' ? ' · Artifact' : ''}
              </span>
            )}
            <MarkdownBody content={entry.content} />
            {Array.isArray(d.properties) && d.properties.length > 0 && (
              <>
                <SectionLabel>Properties</SectionLabel>
                <div className="space-y-1.5">
                  {(d.properties as string[]).map((p, i) => (
                    <div key={i} className="bg-white/[0.03] rounded px-3 py-2 text-sm text-muted-foreground">{p}</div>
                  ))}
                </div>
              </>
            )}
            {d.curse && (
              <>
                <SectionLabel>Curse</SectionLabel>
                <div className="border-l-2 border-red-500/40 pl-3">
                  <p className="text-sm text-muted-foreground">{String(d.curse)}</p>
                </div>
              </>
            )}
          </>
        );
      }

      case 'NPC':
      case 'PC':
        return (
          <>
            <MarkdownBody content={entry.content} />
            <SectionLabel>
              DM Secrets{' '}
              <button
                onClick={() => setSecretsVisible((v) => !v)}
                className="ml-2 inline-flex items-center gap-1 text-[9px] bg-white/[0.05] border border-border/30 rounded px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {secretsVisible ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                {secretsVisible ? 'Hide' : 'Reveal'}
              </button>
            </SectionLabel>
            <div className={cn('text-sm text-muted-foreground/60 italic transition-all', !secretsVisible && 'blur-sm select-none')}>
              {secretsVisible
                ? 'No secrets recorded for this entity yet.'
                : 'Click Reveal to view DM secrets.'}
            </div>
          </>
        );

      case 'FACTION': {
        const goals = Array.isArray(d.goals) ? d.goals as string[] : [];
        const members = Array.isArray(d.keyMembers)
          ? d.keyMembers as Array<{ name: string; role: string }>
          : [];
        return (
          <>
            <MarkdownBody content={entry.content} />
            {goals.length > 0 && (
              <>
                <SectionLabel>Goals</SectionLabel>
                <div className="space-y-1.5">
                  {goals.map((g, i) => (
                    <div key={i} className="bg-white/[0.03] rounded px-3 py-2 text-sm text-muted-foreground">{g}</div>
                  ))}
                </div>
              </>
            )}
            {members.length > 0 && (
              <>
                <SectionLabel>Key Members</SectionLabel>
                <div className="divide-y divide-border/20">
                  {members.map((m) => (
                    <div key={m.name} className="flex items-start gap-4 py-2">
                      <span className="text-sm font-medium text-foreground/90 min-w-[140px]">{m.name}</span>
                      <span className="text-sm text-muted-foreground">{m.role}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      }

      case 'LOCATION': {
        const locs = Array.isArray(d.notableLocations) ? d.notableLocations as Array<{ name: string; type: string; description: string }> : [];
        const npcs = Array.isArray(d.notableNPCs) ? d.notableNPCs as Array<{ name: string; role: string; description: string }> : [];
        const hooks = Array.isArray(d.adventureHooks) ? d.adventureHooks as string[] : [];
        return (
          <>
            <MarkdownBody content={entry.content} />
            {locs.length > 0 && (
              <>
                <SectionLabel>Notable Sub-Locations</SectionLabel>
                <div className="divide-y divide-border/20">
                  {locs.map((l) => (
                    <div key={l.name} className="py-2">
                      <span className="text-sm font-medium text-foreground/90">{l.name}</span>
                      {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {npcs.length > 0 && (
              <>
                <SectionLabel>Notable NPCs</SectionLabel>
                <div className="divide-y divide-border/20">
                  {npcs.map((n) => (
                    <div key={n.name} className="flex items-start gap-4 py-2">
                      <span className="text-sm font-medium text-foreground/90 min-w-[140px]">{n.name}</span>
                      <span className="text-sm text-muted-foreground">{n.role}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {hooks.length > 0 && (
              <>
                <SectionLabel>Adventure Hooks</SectionLabel>
                <div className="space-y-1.5">
                  {hooks.map((h, i) => (
                    <div key={i} className="bg-white/[0.03] rounded px-3 py-2 text-sm text-muted-foreground">{h}</div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      }

      default:
        return <MarkdownBody content={entry.content} />;
    }
  })();

  return (
    <div className="space-y-4">
      <p className={cn('text-[10px] uppercase tracking-widest font-semibold', color)}>{label}</p>

      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground/50">{tag}</span>
          ))}
        </div>
      )}

      {hasSidebar ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">
          <div className="space-y-3 min-w-0">{mainContent}</div>
          <div className="space-y-3">
            <EntitySidebar entry={entry} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">{mainContent}</div>
      )}
    </div>
  );
}
