'use client';

import type { PrepScene } from '@/lib/prep-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SceneRunnerProps {
  scenes: PrepScene[];
  activeIndex: number;
  isExpanded: boolean;
  onNavigate: (index: number) => void;
  onExpandToggle: (expanded: boolean) => void;
}

export function SceneRunner({
  scenes,
  activeIndex,
  isExpanded,
  onNavigate,
  onExpandToggle,
}: SceneRunnerProps) {
  const scene = scenes[activeIndex];

  if (!scene || scenes.length === 0) {
    return (
      <div
        className="px-4 py-2 border-b border-border text-xs text-muted-foreground"
        style={{ background: 'hsl(35 20% 5%)' }}
      >
        No scenes prepared for this session.
        {' '}<a href="#" className="text-amber-400 hover:underline" onClick={e => { e.preventDefault(); }}>Add scenes in prep →</a>
      </div>
    );
  }

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < scenes.length - 1;

  if (!isExpanded) {
    // Collapsed: slim bar
    const preview = scene.readAloud?.slice(0, 60);
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer hover:bg-white/5 transition-colors"
        style={{ background: 'hsl(35 15% 5%)' }}
        onClick={() => onExpandToggle(true)}
      >
        <span className="text-[10px] text-amber-400/60 uppercase tracking-wider shrink-0">
          {activeIndex + 1}/{scenes.length}
        </span>
        <span className="text-xs font-medium text-amber-100/70 shrink-0">{scene.title}</span>
        {preview && (
          <span className="text-xs text-amber-100/30 italic truncate hidden sm:block">
            &quot;{preview}{(scene.readAloud?.length ?? 0) > 60 ? '…' : ''}&quot;
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            disabled={!canPrev}
            onClick={e => { e.stopPropagation(); onNavigate(activeIndex - 1); }}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!canNext}
            onClick={e => { e.stopPropagation(); onNavigate(activeIndex + 1); }}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-amber-400"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded: full scene card
  return (
    <div
      className="border-b border-amber-400/20 px-4 pt-3 pb-4"
      style={{ background: 'hsl(35 20% 5%)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">
            Scene {activeIndex + 1} of {scenes.length}
          </span>
          {scene.location && (
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              {scene.location}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={!canPrev}
            onClick={() => onNavigate(activeIndex - 1)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border hover:border-amber-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </button>
          <button
            disabled={!canNext}
            onClick={() => onNavigate(activeIndex + 1)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Read-aloud block */}
      {scene.readAloud ? (
        <div
          className="rounded-md px-4 py-3"
          style={{
            background: 'hsl(35 25% 7%)',
            borderLeft: '2px solid hsl(35 60% 55% / 0.6)',
          }}
        >
          <p className="text-[9px] uppercase tracking-widest text-amber-400/60 mb-2">Read Aloud</p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'hsl(35 30% 88%)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
          >
            {scene.readAloud}
          </p>
        </div>
      ) : (
        <div className="rounded-md px-4 py-3 border border-dashed border-border">
          <p className="text-xs text-muted-foreground/50 italic">No read-aloud text for this scene.</p>
        </div>
      )}

      {/* Source credit + collapse hint */}
      <div className="flex items-center justify-between mt-2">
        {scene.sourceId ? (
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">From sourcebook</span>
        ) : (
          <span />
        )}
        <button
          onClick={() => onExpandToggle(false)}
          className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          collapse ↑
        </button>
      </div>
    </div>
  );
}
