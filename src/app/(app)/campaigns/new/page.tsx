'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name must be 100 characters or less'),
});

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = trpc.campaigns.create.useMutation({
    onSuccess: (campaign: any) => {
      router.push(`/campaigns/${campaign.slug || campaign.id}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = createCampaignSchema.safeParse({ name: name.trim() });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    create.mutate({ name: name.trim(), description: description || undefined });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Create Campaign</h1>
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">Import from Obsidian</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Already have campaign notes in Obsidian? Import your vault and QuiverDM will extract NPCs,
            sessions, characters, and homebrew content automatically.
          </p>
          <Button variant="outline" asChild>
            <Link href="/campaigns/new/import-obsidian">Import Obsidian Vault</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {create.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {create.error.message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="Curse of Strahd"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({});
                }}
                required
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A Gothic horror adventure in the mists of Barovia..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
