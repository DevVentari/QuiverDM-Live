'use client';

import { useState, type ElementType } from 'react';
import Link from 'next/link';
import { FileText, Search as SearchIcon, User, BookOpen } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
      <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
        <SearchIcon className="h-5 w-5" />
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
        {ENTITY_TYPES.map((type) => (
          <Badge
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggleType(type)}
          >
            {ENTITY_LABELS[type]}
          </Badge>
        ))}
      </div>

      {isFetching && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      )}

      {!isFetching && submittedQuery.length >= 2 && searchResults.length === 0 && (
        <p className="text-muted-foreground text-sm">
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
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_LABELS[result.entityType]}
                        </Badge>
                        {result.metadata?.title && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.metadata.title}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {Math.round(result.score * 100)}% match
                        </span>
                      </div>
                      <p className="text-sm line-clamp-3">{result.chunkText}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
