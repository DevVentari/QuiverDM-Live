'use client';

import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

type PlayerVisibility = 'dm-only' | 'summary-only' | 'public';

interface DmVisibilityControlsProps {
  sessionId: string;
  currentVisibility: PlayerVisibility;
}

const VISIBILITY_OPTIONS: {
  value: PlayerVisibility;
  label: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    value: 'dm-only',
    label: 'DM Only',
    description: 'Players see no session content',
    icon: EyeOff,
  },
  {
    value: 'summary-only',
    label: 'Summary Only',
    description: 'Players see AI summary (if generated)',
    icon: BookOpen,
  },
  {
    value: 'public',
    label: 'Full Access',
    description: 'Players see everything except DM notes',
    icon: Eye,
  },
];

export function DmVisibilityControls({
  sessionId,
  currentVisibility,
}: DmVisibilityControlsProps) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.sessions.updateVisibility.useMutation({
    onSuccess: () => {
      toast.success('Player visibility updated');
      void utils.sessions.getById.invalidate({ id: sessionId });
    },
    onError: (e) => toast.error(e.message),
  });

  const current =
    VISIBILITY_OPTIONS.find((option) => option.value === currentVisibility) ??
    VISIBILITY_OPTIONS[0];

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Player Visibility</Label>
      <Select
        value={currentVisibility}
        onValueChange={(value) =>
          updateMutation.mutate({
            sessionId,
            playerVisibility: value as PlayerVisibility,
          })
        }
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <current.icon className="h-3 w-3" />
              {current.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div>
                <span className="font-medium">{option.label}</span>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
