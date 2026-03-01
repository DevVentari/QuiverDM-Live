'use client';

import type { SessionPrepData } from '@/lib/prep-types';
import { ScrollText, Zap, Map, Eye, Users, Swords, Gift, GitBranch, User } from 'lucide-react';

interface PrepReferencePanelProps {
  prepData: SessionPrepData | null;
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed pl-5">{children}</div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return <p className="italic text-muted-foreground/50 text-[10px]">No {label} prepared</p>;
}

export function PrepReferencePanel({ prepData }: PrepReferencePanelProps) {
  if (!prepData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <ScrollText className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground italic">No prep data for this session</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strong Start */}
      <Section icon={Zap} title="Strong Start">
        {prepData.strongStart ? (
          <p className="whitespace-pre-wrap">{prepData.strongStart}</p>
        ) : (
          <EmptySlot label="strong start" />
        )}
      </Section>

      {/* Scenes */}
      <Section icon={Map} title="Scenes">
        {prepData.scenes.length > 0 ? (
          <ul className="space-y-1">
            {prepData.scenes.map((scene) => (
              <li key={scene.id} className="space-y-0.5">
                <p className="font-medium text-foreground/80 text-[11px]">{scene.title}</p>
                {scene.description && <p className="text-[10px]">{scene.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="scenes" />
        )}
      </Section>

      {/* Secrets & Clues */}
      <Section icon={Eye} title="Secrets & Clues">
        {prepData.secretsAndClues.length > 0 ? (
          <ul className="space-y-0.5">
            {prepData.secretsAndClues.map((s) => (
              <li key={s.id} className="text-[10px] leading-snug">· {s.text}</li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="secrets" />
        )}
      </Section>

      {/* NPCs */}
      <Section icon={Users} title="NPCs">
        {prepData.npcs.length > 0 ? (
          <ul className="space-y-0.5">
            {prepData.npcs.map((npc, i) => (
              <li key={i} className="flex items-center gap-1 text-[10px]">
                <span className="font-medium text-foreground/80">{npc.name}</span>
                {npc.role && <span className="text-muted-foreground/70">· {npc.role}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="NPCs" />
        )}
      </Section>

      {/* Monsters */}
      <Section icon={Swords} title="Monsters">
        {prepData.monsters.length > 0 ? (
          <ul className="space-y-0.5">
            {prepData.monsters.map((m, i) => (
              <li key={i} className="text-[10px]">
                {m.count > 1 ? `${m.count}× ` : ''}{m.name}{m.cr ? ` (CR ${m.cr})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="monsters" />
        )}
      </Section>

      {/* Rewards */}
      <Section icon={Gift} title="Rewards">
        {prepData.rewards.length > 0 ? (
          <ul className="space-y-0.5">
            {prepData.rewards.map((r, i) => (
              <li key={i} className="text-[10px]">
                {r.name}{r.rarity ? ` (${r.rarity})` : ''}{r.notes ? ` — ${r.notes}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="rewards" />
        )}
      </Section>

      {/* Loose Threads */}
      <Section icon={GitBranch} title="Loose Threads">
        {prepData.looseThreads.length > 0 ? (
          <ul className="space-y-0.5">
            {prepData.looseThreads.map((t) => (
              <li key={t.id} className="text-[10px] leading-snug">· {t.text}</li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="loose threads" />
        )}
      </Section>

      {/* Character Notes */}
      <Section icon={User} title="Character Notes">
        {prepData.characterNotes.length > 0 ? (
          <ul className="space-y-1.5">
            {prepData.characterNotes.map((cn) => (
              <li key={cn.characterId} className="space-y-0.5">
                <p className="font-medium text-foreground/80 text-[11px]">{cn.name}</p>
                {cn.goals && <p className="text-[10px]">Goals: {cn.goals}</p>}
                {cn.notes && <p className="text-[10px]">{cn.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlot label="character notes" />
        )}
      </Section>
    </div>
  );
}
