'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Maximize2, Minimize2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '@/hooks/use-auto-save';

export function PrepHeader({
  title,
  onTitleChange,
  saveStatus,
  slug,
  onComplete,
  isCompleting,
  prepStatus,
  isFullscreen,
  onToggleFullscreen,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  saveStatus: SaveStatus;
  slug: string;
  onComplete: () => void;
  isCompleting: boolean;
  prepStatus: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-3',
        isFullscreen
          ? 'border-b border-amber-900/20 bg-black/30 backdrop-blur-md'
          : 'border-b border-border/50 bg-background/50 backdrop-blur-sm'
      )}
    >
      {/* Back link */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 shrink-0',
          isFullscreen && 'text-amber-200/50 hover:text-amber-200 hover:bg-amber-900/20'
        )}
        asChild
      >
        <Link href={`/campaigns/${slug}/sessions`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      {/* Title input */}
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className={cn(
          'h-8 max-w-xs border-0 bg-transparent px-1 font-display text-base font-semibold focus-visible:ring-0 focus-visible:ring-offset-0',
          isFullscreen && 'text-amber-100/90 placeholder:text-amber-900/50'
        )}
        placeholder="Session title..."
      />

      <div className="flex-1" />

      {/* Save status */}
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs',
          isFullscreen ? 'text-amber-200/30' : 'text-muted-foreground'
        )}
      >
        {saveStatus === 'saving' ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </>
        ) : saveStatus === 'unsaved' ? (
          <>
            <Save className="h-3 w-3" />
            Unsaved
          </>
        ) : saveStatus === 'error' ? (
          <span className="text-destructive">Error</span>
        ) : (
          <>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isFullscreen ? 'bg-amber-600/60' : 'bg-emerald-500/60'
              )}
            />
            Saved
          </>
        )}
      </span>

      {/* Complete prep */}
      {prepStatus !== 'complete' ? (
        <Button
          size="sm"
          onClick={onComplete}
          disabled={isCompleting}
          className={cn(
            'gap-1.5',
            isFullscreen
              ? 'bg-amber-600 hover:bg-amber-500 text-black font-semibold shadow-[0_0_16px_rgba(212,168,83,0.25)]'
              : ''
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isCompleting ? 'Saving...' : 'Complete Prep'}
        </Button>
      ) : (
        <Badge
          variant="outline"
          className={cn(
            isFullscreen
              ? 'border-amber-600/40 text-amber-400'
              : 'border-emerald-500/30 text-emerald-400'
          )}
        >
          Prep Complete
        </Badge>
      )}

      {/* Fullscreen toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className={cn(
          'h-8 w-8 shrink-0',
          isFullscreen
            ? 'text-amber-200/40 hover:text-amber-200/80 hover:bg-amber-900/20'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
