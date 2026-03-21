'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';

interface BrainQueryPanelProps {
  campaignId: string;
  campaignSlug: string;
}

export function BrainQueryPanel({ campaignId, campaignSlug }: BrainQueryPanelProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const isBrainRoute = pathname.includes('/brain');

  const queryMutation = trpc.brain.query.useMutation();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isBrainRoute) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    },
    [isBrainRoute]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSubmit() {
    if (!question.trim()) return;
    setSubmittedQuestion(question.trim());
    queryMutation.mutate({ campaignId, question: question.trim() });
  }

  function handleSelect(entityId: string) {
    setOpen(false);
    router.push(`/campaigns/${campaignSlug}/brain/entities/${entityId}`);
  }

  const result = queryMutation.data;

  return (
    <CommandDialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setQuestion('');
        setSubmittedQuestion('');
        queryMutation.reset();
      }
    }}>
      <CommandInput
        placeholder="Ask anything about your world... (press Enter to search)"
        value={question}
        onValueChange={setQuestion}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <CommandList>
        {queryMutation.isPending && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Querying world knowledge...
          </div>
        )}

        {result && !queryMutation.isPending && (
          <>
            <CommandGroup heading="Answer">
              <div className="px-3 py-2 text-sm text-foreground leading-relaxed">
                {result.answer}
              </div>
            </CommandGroup>

            {result.relatedEntities.length > 0 && (
              <CommandGroup heading="Related Entities">
                {result.relatedEntities.map((entity) => (
                  <CommandItem
                    key={entity.id}
                    value={entity.name}
                    onSelect={() => handleSelect(entity.id)}
                    className="flex items-start gap-2 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{entity.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                          {entity.type}
                        </Badge>
                      </div>
                      {entity.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {entity.description.slice(0, 100)}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {!queryMutation.isPending && !result && !submittedQuestion && (
          <CommandEmpty>Type a question and press Enter to query the world.</CommandEmpty>
        )}

        {!queryMutation.isPending && !result && submittedQuestion && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  );
}
