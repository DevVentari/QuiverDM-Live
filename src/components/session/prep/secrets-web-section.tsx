'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Trash2, Plus } from 'lucide-react';

interface SecretsWebSectionProps {
  campaignId: string;
  sessionId: string;
}

export function SecretsWebSection({ campaignId, sessionId }: SecretsWebSectionProps) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', content: '' });

  const { data: secrets, refetch } = trpc.prepSecrets.list.useQuery({ campaignId, sessionId });
  const create = trpc.prepSecrets.create.useMutation({
    onSuccess: () => {
      refetch();
      setCreating(false);
      setForm({ name: '', content: '' });
    },
  });
  const del = trpc.prepSecrets.delete.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-3">
      {secrets?.map(secret => (
        <div key={secret.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{secret.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{secret.content}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {secret.knowledge.map(k => (
                <Badge key={k.id} variant="outline" className="text-xs gap-1">
                  {k.isCritical && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                  {k.worldEntity.name}
                  {k.revealCondition && <span className="opacity-50">· {k.revealCondition}</span>}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => del.mutate({ campaignId, id: secret.id })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {creating ? (
        <div className="space-y-2 p-3 rounded-md border border-border bg-muted/20">
          <Input
            placeholder="Secret name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            placeholder="Secret content — what the DM knows"
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => create.mutate({
                campaignId,
                name: form.name,
                content: form.content,
                sessionId,
                orderIndex: secrets?.length ?? 0,
              })}
              disabled={!form.name || !form.content || create.isPending}
            >
              Add secret
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> Add secret
        </Button>
      )}
    </div>
  );
}
