'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ScrollText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function SessionsPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const { toast } = useToast();
  const sessions = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const create = trpc.sessions.create.useMutation({
    onSuccess: () => {
      utils.sessions.getAll.invalidate({ campaignId });
      setOpen(false);
      setTitle('');
      setNotes('');
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });


  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold">Sessions</h2>
        {isDM && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Session</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate({
                    campaignId,
                    title: title || undefined,
                    quickNotes: notes || undefined,
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Session 1: The Beginning"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Quick Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Pre-session notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={create.isPending} className="w-full">
                  {create.isPending ? 'Creating...' : 'Create Session'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sessions.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : sessions.data && sessions.data.length > 0 ? (
        <div className="space-y-3">
          {(sessions.data as any[]).map((session) => (
            <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
              <Card className="hover:border-foreground/50 transition-colors cursor-pointer">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {session.title || `Session ${session.sessionNumber || ''}`}
                    </CardTitle>
                    {session.status && (
                      <Badge variant="secondary">
                        {session.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {session.createdAt && format(new Date(session.createdAt), 'MMM d, yyyy')}
                    {session.quickNotes && ` — ${session.quickNotes.slice(0, 100)}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ScrollText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Sessions track your D&D game nights - recordings, transcripts, and AI recaps all live here.
            </p>
            {isDM && (
              <Button size="sm" onClick={() => setOpen(true)}>New Session</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
