'use client';

import { useRef, useEffect } from 'react';
import { Pencil, X, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecapSectionProps {
  sectionKey: string;
  title: string;
  content: string;
  isEditing: boolean;
  isRegenerating: boolean;
  regenNote: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onContentChange: (content: string) => void;
  onRegenNoteChange: (note: string) => void;
  onRegenerate: () => void;
}

export function RecapSection({
  sectionKey: _sectionKey,
  title,
  content,
  isEditing,
  isRegenerating,
  regenNote,
  onEdit,
  onCancelEdit,
  onContentChange,
  onRegenNoteChange,
  onRegenerate,
}: RecapSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  return (
    <div
      className="py-4 first:pt-0"
      style={
        isEditing
          ? { borderLeft: '2px solid hsl(35 60% 42% / 0.5)', paddingLeft: '12px' }
          : {}
      }
    >
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 60% 42%)' }}
        >
          {title}
        </h3>
        <div className="flex gap-1">
          {isEditing ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
              onClick={onEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit();
            }}
            rows={6}
            className="w-full resize-none rounded-sm px-3 py-2 text-sm leading-relaxed focus:outline-none"
            style={{
              background: 'hsl(35 10% 8% / 0.8)',
              border: '1px solid hsl(35 20% 22% / 0.6)',
              color: 'hsl(35 10% 72%)',
              fontFamily: 'var(--font-bricolage)',
              lineHeight: '1.65',
            }}
          />
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={regenNote}
              onChange={(e) => onRegenNoteChange(e.target.value)}
              placeholder="Note for AI regen… (optional)"
              className="flex-1 h-7 px-2 text-xs rounded-sm focus:outline-none"
              style={{
                background: 'hsl(35 10% 8% / 0.6)',
                border: '1px solid hsl(35 15% 18% / 0.5)',
                color: 'hsl(35 10% 60%)',
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs px-2"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regen
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm leading-relaxed cursor-text"
          style={{
            fontFamily: 'var(--font-bricolage)',
            color: 'hsl(35 10% 72%)',
            lineHeight: '1.65',
          }}
          onClick={onEdit}
        >
          {content}
        </p>
      )}
    </div>
  );
}
