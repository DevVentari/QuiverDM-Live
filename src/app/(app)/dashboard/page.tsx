'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Swords, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { toast } = useToast();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery();
  const characters = trpc.characters.getMyCharacters.useQuery();
  const invites = trpc.campaigns.getPendingInvites.useQuery();
  const utils = trpc.useUtils();

  const acceptInvite = trpc.campaigns.acceptInvite.useMutation({
    onSuccess: () => {
      utils.campaigns.getPendingInvites.invalidate();
      utils.campaigns.getMyMemberships.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const declineInvite = trpc.campaigns.declineInvite.useMutation({
    onSuccess: () => {
      utils.campaigns.getPendingInvites.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Pending Invites */}
      {invites.data && invites.data.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pending Invites</h2>
          {invites.data.map((invite: any) => (
            <Card key={invite.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{invite.campaign?.name || 'Campaign'}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited as {invite.role || 'player'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptInvite.mutate({ inviteId: invite.id })}
                    disabled={acceptInvite.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declineInvite.mutate({ inviteId: invite.id })}
                    disabled={declineInvite.isPending}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campaigns */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">My Campaigns</h2>
        {campaigns.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : campaigns.data && campaigns.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.data.map((campaign: any) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.slug || campaign.id}`}
              >
                <Card className="h-full hover:border-foreground/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      {campaign.role && (
                        <Badge variant="secondary" className="text-xs">
                          {campaign.role}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {campaign.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{campaign._count?.sessions || 0} sessions</span>
                      <span>{campaign._count?.npcs || 0} NPCs</span>
                      <span>{campaign._count?.members || campaign._count?.campaignMembers || 0} members</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Swords className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No campaigns yet. Create one to get started!
              </p>
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Characters */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">My Characters</h2>
        {characters.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : characters.data && characters.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.data.map((char: any) => (
              <Link key={char.id} href={`/characters/${char.id}`}>
                <Card className="hover:border-foreground/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{char.name}</CardTitle>
                    <CardDescription>
                      {[char.race, char.class, char.level && `Level ${char.level}`]
                        .filter(Boolean)
                        .join(' · ') || 'No details'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No characters yet.{' '}
            <Link href="/characters/new" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
