'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SaveStatus } from '@/hooks/use-auto-save';

export function PrepHeader({
  title,
  onTitleChange,
  saveStatus,
  slug,
  onComplete,
  isCompleting,
  prepStatus,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  saveStatus: SaveStatus;
  slug: string;
  onComplete: () => void;
  isCompleting: boolean;
  prepStatus: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 bg-background/50 px-4 py-3 backdrop-blur-sm">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
        <Link href={`/campaigns/${slug}/sessions`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="h-8 max-w-xs border-0 bg-transparent px-1 font-display text-base font-semibold focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Session title..."
      />

      <div className="flex-1" />

      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
        {saveStatus === 'saving'
          ? 'Saving...'
          : saveStatus === 'unsaved'
            ? 'Unsaved'
            : saveStatus === 'error'
              ? 'Error'
              : 'Saved'}
      </span>

      {prepStatus !== 'complete' ? (
        <Button
          size="sm"
          onClick={onComplete}
          disabled={isCompleting}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isCompleting ? 'Saving...' : 'Complete Prep'}
        </Button>
      ) : (
        <Badge
          variant="outline"
          className="border-emerald-500/30 text-emerald-400"
        >
          Prep Complete
        </Badge>
      )}
    </div>
  );
}

