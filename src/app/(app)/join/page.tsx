'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [code, setCode] = useState(searchParams.get('code') || '');

  const acceptInvite = trpc.members.acceptInvite.useMutation({
    onSuccess: (data: any) => {
      router.push(`/campaigns/${data.campaign?.slug || data.campaignId || '/campaigns'}`);
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
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Join a Campaign</CardTitle>
          <CardDescription>
            Enter the invite code you received from your DM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {acceptInvite.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
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
                className="font-mono"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={acceptInvite.isPending}>
              {acceptInvite.isPending ? 'Joining...' : 'Join Campaign'}
            </Button>
          </form>
        </CardContent>
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
