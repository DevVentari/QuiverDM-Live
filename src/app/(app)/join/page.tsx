'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/primitives';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [code, setCode] = useState(searchParams.get('code') || '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acceptInvite = trpc.members.acceptInvite.useMutation({
    onSuccess: (data: any) => {
      router.push(`/campaigns/${data.campaignSlug || data.campaign?.slug || '/campaigns'}`);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim()) {
      acceptInvite.mutate({ code: code.trim() });
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6">
      <Card variant="detail" className="space-y-5">
        <div className="space-y-1">
          <h1 className="font-[var(--q-font-display)] text-xl tracking-wide text-[var(--q-text)]">Join a Campaign</h1>
          <p className="text-sm text-[var(--q-text-dim)]">
            Enter the invite code you received from your DM.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {acceptInvite.error && (
            <div className="rounded-sm bg-destructive/10 border border-destructive/20 p-3 text-sm text-[var(--q-text-danger)]">
              {acceptInvite.error.message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">Invite Code</Label>
            <Input
              id="code"
              placeholder="Enter invite code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-[var(--q-font-mono)]"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={acceptInvite.isPending}>
            {acceptInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {acceptInvite.isPending ? 'Joining...' : 'Join Campaign'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function JoinCampaignPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
