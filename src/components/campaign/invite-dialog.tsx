'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from './campaign-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Copy, Check, Loader2 } from 'lucide-react';

export function InviteDialog() {
  const { campaignId } = useCampaign();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>('PLAYER');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const createInvite = trpc.members.createInvite.useMutation({
    onSuccess: (data: any) => {
      setCode(data.code || data.inviteCode || '');
    },
  });

  function handleCreate() {
    createInvite.mutate({
      campaignId,
      role: role as any,
      email: email || undefined,
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCode(''); setEmail(''); setRole('PLAYER'); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Campaign</DialogTitle>
          <DialogDescription>
            Create an invite code to share with a player.
          </DialogDescription>
        </DialogHeader>
        {code ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invite Code</Label>
              <div className="flex gap-2">
                <Input value={code} readOnly className="font-mono" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this code. They can use it at /join to join the campaign.
            </p>
            <Button onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLAYER">Player</SelectItem>
                  <SelectItem value="SPECTATOR">Spectator</SelectItem>
                  <SelectItem value="CO_DM">Co-DM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input
                type="email"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={createInvite.isPending} className="w-full">
              {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invite
            </Button>
            {createInvite.error && (
              <p className="text-sm text-destructive">{createInvite.error.message}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
