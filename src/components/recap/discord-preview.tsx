'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface RecapSectionData {
  key: string;
  title: string;
  content: string;
}

interface DiscordPreviewProps {
  sessionTitle: string;
  sections: RecapSectionData[];
  charLimit: 2000 | 3000;
  threadMode: boolean;
  isPending: boolean;
  onCharLimitChange: (limit: 2000 | 3000) => void;
  onThreadModeChange: (enabled: boolean) => void;
  onShare: () => void;
  onCancel: () => void;
}

function buildDiscordMessage(sessionTitle: string, sections: RecapSectionData[]): string {
  const header = `**${sessionTitle} — Session Recap**\n\n`;
  const body = sections
    .filter((s) => s.title && s.content)
    .map((s) => `**${s.title}**\n${s.content}`)
    .join('\n\n');
  return header + body;
}

function PillToggle<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-sm overflow-hidden"
      style={{ border: '1px solid hsl(35 15% 20% / 0.6)' }}
    >
      {options.map((opt, i) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 text-xs transition-colors"
          style={{
            background: opt.value === value ? 'hsl(35 60% 38% / 0.4)' : 'transparent',
            color: opt.value === value ? 'hsl(35 70% 60%)' : 'hsl(35 5% 45%)',
            borderRight:
              i < options.length - 1 ? '1px solid hsl(35 15% 20% / 0.4)' : undefined,
            fontFamily: 'var(--font-bricolage)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DiscordPreview({
  sessionTitle,
  sections,
  charLimit,
  threadMode,
  isPending,
  onCharLimitChange,
  onThreadModeChange,
  onShare,
  onCancel,
}: DiscordPreviewProps) {
  const fullMessage = useMemo(
    () => buildDiscordMessage(sessionTitle, sections),
    [sessionTitle, sections],
  );

  const charCount = fullMessage.length;
  const exceedsLimit = !threadMode && charCount > charLimit;
  const ratio = charCount / charLimit;
  const countColor =
    ratio > 1
      ? 'hsl(0 70% 55%)'
      : ratio > 0.9
        ? 'hsl(35 80% 52%)'
        : 'hsl(35 5% 45%)';

  const previewText =
    fullMessage.length > 400 ? fullMessage.slice(0, 400) + '…' : fullMessage;

  return (
    <div className="space-y-4">
      {/* Mock Discord message */}
      <div
        className="rounded-sm p-4"
        style={{
          background: 'hsl(240 10% 9%)',
          borderLeft: '3px solid hsl(35 60% 42%)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-semibold"
            style={{ color: 'hsl(35 60% 62%)', fontFamily: 'var(--font-bricolage)' }}
          >
            QuiverDM BOT
          </span>
          <span className="text-[10px]" style={{ color: 'hsl(35 5% 38%)' }}>
            Today
          </span>
        </div>
        <p
          className="text-xs leading-relaxed whitespace-pre-wrap"
          style={{ color: 'hsl(35 5% 60%)', fontFamily: 'var(--font-bricolage)' }}
        >
          {previewText}
        </p>
        <div
          className="flex items-center justify-between mt-3 pt-2"
          style={{ borderTop: '1px solid hsl(35 10% 18% / 0.4)' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: countColor }}>
            {charCount.toLocaleString()} / {charLimit.toLocaleString()}
          </span>
          {threadMode && (
            <span className="text-[10px]" style={{ color: 'hsl(200 60% 55%)' }}>
              Thread mode — will split automatically
            </span>
          )}
        </div>
      </div>

      {/* Format toggles */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'hsl(35 5% 45%)' }}>
            Format:
          </span>
          <PillToggle
            options={[
              { label: 'Standard (2000)', value: 2000 as const },
              { label: 'Nitro (3000)', value: 3000 as const },
            ]}
            value={charLimit}
            onChange={onCharLimitChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'hsl(35 5% 45%)' }}>
            Mode:
          </span>
          <PillToggle
            options={[
              { label: 'Single post', value: 'single' as const },
              { label: 'Thread (split)', value: 'thread' as const },
            ]}
            value={threadMode ? 'thread' : 'single'}
            onChange={(v) => onThreadModeChange(v === 'thread')}
          />
        </div>
      </div>

      {exceedsLimit && (
        <p className="text-xs" style={{ color: 'hsl(0 70% 55%)' }}>
          Content exceeds {charLimit} characters. Switch to Thread mode or reduce content.
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onShare} disabled={isPending || exceedsLimit}>
          {isPending ? 'Posting…' : 'Share to Discord'}
        </Button>
      </div>
    </div>
  );
}
