'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Brain, AlertCircle, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BrainCockpitPanelProps {
  campaignId: string;
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

export function BrainCockpitPanel({ campaignId }: BrainCockpitPanelProps) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const stateQuery = trpc.brain.state.get.useQuery({ campaignId });
  const entitiesQuery = trpc.brain.entities.list.useQuery({ campaignId });
  const searchQuery = trpc.brain.entities.list.useQuery(
    { campaignId, search: submittedQuery },
    { enabled: submittedQuery.length > 0 }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSubmittedQuery(query.trim());
    }
  };

  const hooks = (stateQuery.data as any)?.hooks ?? [];
  const urgentHooks = hooks.filter((h: any) => h.urgency === 'high').slice(0, 3);
  const entities = (entitiesQuery.data as any) ?? [];
  const searchResults = (searchQuery.data as any) ?? [];

  return (
    <div className="space-y-4">
      {/* Brain Query */}
      <Section icon={Brain} title="Query Brain">
        <form onSubmit={handleSubmit} className="flex gap-1.5 mt-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities..."
            className="h-7 text-[11px] bg-background/50"
          />
          <Button type="submit" size="icon" className="h-7 w-7 shrink-0" variant="outline">
            <Send className="h-3 w-3" />
          </Button>
        </form>
        {submittedQuery && (
          <div className="mt-2 rounded border border-amber-400/20 bg-amber-400/5 p-2">
            {searchQuery.isLoading ? (
              <p className="text-[10px] italic text-muted-foreground/60">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-[10px] italic text-muted-foreground/60">No entities found for &ldquo;{submittedQuery}&rdquo;</p>
            ) : (
              <ul className="space-y-0.5">
                {searchResults.slice(0, 5).map((e: any) => (
                  <li key={e.id} className="flex items-center gap-1 text-[10px]">
                    <span className="font-medium text-foreground/80">{e.name}</span>
                    <span className="text-muted-foreground/60">· {e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* Urgent Hooks */}
      <Section icon={AlertCircle} title="Urgent Hooks">
        {stateQuery.isLoading ? (
          <p className="text-[10px] italic text-muted-foreground/60">Loading...</p>
        ) : urgentHooks.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground/50">No urgent hooks</p>
        ) : (
          <ul className="space-y-1">
            {urgentHooks.map((hook: any, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] leading-snug">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <span>{hook.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Recent Entities */}
      <Section icon={User} title="Recent Entities">
        {entitiesQuery.isLoading ? (
          <p className="text-[10px] italic text-muted-foreground/60">Loading...</p>
        ) : entities.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground/50">No entities tracked yet</p>
        ) : (
          <ul className="space-y-0.5">
            {entities.slice(0, 8).map((entity: any) => (
              <li key={entity.id} className="flex items-center gap-1.5 text-[10px]">
                <span className="font-medium text-foreground/80">{entity.name}</span>
                <span className="rounded border border-border px-1 py-0 text-[9px] text-muted-foreground/60 uppercase tracking-wide">
                  {entity.type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
