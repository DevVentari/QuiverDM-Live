'use client';

import { useState } from 'react';
import type { SessionPrepData, PrepScene } from '@/lib/prep-types';
import { Users, Eye, Swords, Dices } from 'lucide-react';

interface SourcebookSceneData {
  id: string;
  rollTables: { name: string; die: string; entries: string[] }[];
  linkedNpcs: { name: string; role?: string }[];
  linkedMonsters: { name: string; cr?: string; count: number }[];
}

interface SceneContextPanelProps {
  activeScene: PrepScene | null;
  prepData: SessionPrepData | null;
  sourcebookScenes: SourcebookSceneData[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EntityChip({ name, subtitle, auto }: { name: string; subtitle?: string; auto?: boolean }) {
  return (
    <div className="rounded px-2 py-1.5 text-xs border border-border bg-card/50">
      <div className="flex items-center gap-1">
        {auto && <span className="text-muted-foreground/50">~</span>}
        <span className={auto ? 'text-muted-foreground' : ''}>{name}</span>
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function RollTableWidget({ table }: { table: { name: string; die: string; entries: string[] } }) {
  const [result, setResult] = useState<string | null>(null);
  const sides = parseInt(table.die.replace('d', ''), 10);
  const roll = () => {
    const idx = Math.floor(Math.random() * table.entries.length);
    setResult(table.entries[idx] ?? String(Math.ceil(Math.random() * sides)));
  };
  return (
    <div className="rounded px-2 py-1.5 border border-border bg-card/50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-amber-400/80">{table.name}</span>
        <button
          onClick={roll}
          className="text-[10px] px-2 py-0.5 rounded border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 transition-colors"
        >
          {table.die}
        </button>
      </div>
      {result && (
        <p className="text-xs mt-1.5 px-2 py-1 rounded bg-amber-400/15 text-amber-200 border border-amber-400/20">
          → {result}
        </p>
      )}
    </div>
  );
}

export function SceneContextPanel({ activeScene, prepData, sourcebookScenes }: SceneContextPanelProps) {
  if (!activeScene || !prepData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Swords className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground italic">No scene active</p>
      </div>
    );
  }

  const sceneText = [activeScene.title, activeScene.description, activeScene.location]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const linkedNpcs = prepData.npcs.filter(n => (activeScene.linkedNpcIds ?? []).includes(n.id));
  const linkedSecrets = prepData.secretsAndClues.filter(s => (activeScene.linkedSecretIds ?? []).includes(s.id));
  const linkedMonsters = prepData.monsters.filter(m => (activeScene.linkedMonsterNames ?? []).includes(m.name));

  const autoNpcs = prepData.npcs.filter(n =>
    !linkedNpcs.includes(n) && sceneText.includes(n.name.toLowerCase())
  );
  const autoSecrets = prepData.secretsAndClues.filter(s =>
    !linkedSecrets.includes(s) &&
    s.linkedTo != null &&
    activeScene.location != null &&
    normalize(s.linkedTo) === normalize(activeScene.location)
  );
  const autoMonsters = prepData.monsters.filter(m =>
    !linkedMonsters.includes(m) && sceneText.includes(m.name.toLowerCase())
  );

  const sbScene = activeScene.sourceId
    ? sourcebookScenes.find(s => s.id === activeScene.sourceId)
    : null;
  const rollTables = (sbScene?.rollTables ?? []) as { name: string; die: string; entries: string[] }[];

  const allNpcs = [...linkedNpcs, ...autoNpcs];
  const allSecrets = [...linkedSecrets, ...autoSecrets];
  const allMonsters = [...linkedMonsters, ...autoMonsters];

  const isEmpty = allNpcs.length === 0 && allSecrets.length === 0 && allMonsters.length === 0 && rollTables.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2 px-3">
        <Swords className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground italic">
          No content linked to this scene.
          <br />
          <span className="text-[10px]">Tag NPCs, secrets, and monsters in prep to surface them here.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allNpcs.length > 0 && (
        <Section icon={Users} title="NPCs">
          {allNpcs.map(n => (
            <EntityChip
              key={n.id}
              name={n.name}
              subtitle={n.role}
              auto={autoNpcs.includes(n)}
            />
          ))}
        </Section>
      )}

      {allMonsters.length > 0 && (
        <Section icon={Swords} title="Encounter">
          {allMonsters.map(m => (
            <EntityChip
              key={m.name}
              name={`${m.count > 1 ? `${m.count}× ` : ''}${m.name}`}
              subtitle={m.cr ? `CR ${m.cr}` : undefined}
              auto={autoMonsters.includes(m)}
            />
          ))}
        </Section>
      )}

      {allSecrets.length > 0 && (
        <Section icon={Eye} title="Secrets">
          {allSecrets.map(s => (
            <div
              key={s.id}
              className={`rounded px-2 py-1.5 text-xs border border-border bg-card/50 ${autoSecrets.includes(s) ? 'opacity-70' : ''}`}
            >
              <p className="leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </Section>
      )}

      {rollTables.length > 0 && (
        <Section icon={Dices} title="Tables">
          {rollTables.map((t, i) => (
            <RollTableWidget key={i} table={t} />
          ))}
        </Section>
      )}
    </div>
  );
}
