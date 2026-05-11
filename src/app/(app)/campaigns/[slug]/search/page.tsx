'use client';

import { useState, type ElementType } from 'react';
import Link from 'next/link';
import { FileText, Search as SearchIcon, User, BookOpen } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Surface, Pill } from '@/components/primitives';

const ENTITY_ICONS: Record<string, ElementType> = {
  transcript: FileText,
  npc: User,
  quest: BookOpen,
  rules: BookOpen,
};

const ENTITY_LABELS: Record<string, string> = {
  transcript: 'Transcript',
  npc: 'NPC',
  quest: 'Quest',
  rules: 'Rules',
};

const ENTITY_TYPES = ['transcript', 'npc', 'quest', 'rules'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

type SearchResult = {
  entityId: string;
  entityType: EntityType;
  chunkText: string;
  metadata?: {
    title?: string;
    sessionId?: string;
  };
  score: number;
};

export default function SearchPage() {
  const { campaignId, slug } = useCampaign();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([]);

  const { data: results, isFetching } = trpc.search.semantic.useQuery(
    {
      query: submittedQuery,
      campaignId,
      entityTypes: selectedTypes,
      limit: 12,
    },
    {
      enabled: submittedQuery.length >= 2,
      staleTime: 30_000,
    }
  );

  const toggleType = (type: EntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const searchResults = (results ?? []) as SearchResult[];

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text)] flex items-center gap-2">
        <SearchIcon className="h-5 w-5 text-[var(--q-amber)]" />
        Search
      </h2>

      <div className="flex gap-2">
        <Input
          placeholder="Search across transcripts, NPCs, and more..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.length >= 2) {
              setSubmittedQuery(query);
            }
          }}
          className="flex-1"
        />
        <Button onClick={() => setSubmittedQuery(query)} disabled={query.length < 2}>
          Search
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {ENTITY_TYPES.map((type) => {
          const isActive = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] tracking-wide border transition-colors ${
                isActive
                  ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)] text-[var(--q-text-dim)] hover:text-[var(--q-text)] hover:border-[var(--q-amber-border)]'
              }`}
            >
              {ENTITY_LABELS[type]}
            </button>
          );
        })}
      </div>

      {isFetching && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] rounded-sm" />
          ))}
        </div>
      )}

      {!isFetching && submittedQuery.length >= 2 && searchResults.length === 0 && (
        <p className="text-[var(--q-text-dim)] text-sm">
          No results found for &quot;{submittedQuery}&quot;.
        </p>
      )}

      <div className="space-y-3">
        {searchResults.map((result, index) => {
          const Icon = ENTITY_ICONS[result.entityType] ?? FileText;
          const href =
            result.entityType === 'npc'
              ? `/campaigns/${slug}/npcs/${result.entityId}`
              : result.metadata?.sessionId
                ? `/campaigns/${slug}/sessions/${result.metadata.sessionId}`
                : '#';

          return (
            <Link key={`${result.entityType}-${result.entityId}-${index}`} href={href}>
              <Surface variant="utility" className="hover:border-[var(--q-amber-border)] transition-colors cursor-pointer p-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 text-[var(--q-text-faint)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Pill variant="neutral">{ENTITY_LABELS[result.entityType]}</Pill>
                      {result.metadata?.title && (
                        <span className="text-xs text-[var(--q-text-dim)] truncate">
                          {result.metadata.title}
                        </span>
                      )}
                      <span className="text-xs text-[var(--q-text-faint)] ml-auto tabular-nums">
                        {Math.round(result.score * 100)}% match
                      </span>
                    </div>
                    <p className="text-sm line-clamp-3 text-[var(--q-text)]">{result.chunkText}</p>
                  </div>
                </div>
              </Surface>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
