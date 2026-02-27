'use client';

import { useState } from 'react';
import { Check, Edit2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function AiSuggestionCard({
  suggestion,
  onAccept,
  onDiscard,
  label = 'AI Suggestion',
}: {
  suggestion: string;
  onAccept: (value: string) => void;
  onDiscard: () => void;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(suggestion);

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </div>

      {editing ? (
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="min-h-[80px] text-sm"
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {editValue}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onAccept(editValue)} className="h-7 gap-1.5">
          <Check className="h-3 w-3" />
          Accept
        </Button>
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="h-7 gap-1.5"
          >
            <Edit2 className="h-3 w-3" />
            Edit
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
            className="h-7"
          >
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDiscard}
          className="ml-auto h-7 gap-1.5 text-muted-foreground"
        >
          <X className="h-3 w-3" />
          Discard
        </Button>
      </div>
    </div>
  );
}

