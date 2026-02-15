'use client';

import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PlayersPage() {
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
  const characters = trpc.characters.getCampaignCharacters.useQuery({ campaignId });
  const utils = trpc.useUtils();

  const approve = trpc.characters.approveCharacter.useMutation({
    onSuccess: () => utils.characters.getCampaignCharacters.invalidate({ campaignId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (characters.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  const chars = (characters.data || []) as any[];

  if (chars.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No characters in this campaign yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8">
      <h2 className="text-lg sm:text-xl font-semibold">Party</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chars.map((cc) => {
          const char = cc.character || cc;
          const owner = cc.character?.owner || cc.owner;
          return (
            <Card key={cc.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{char.name}</CardTitle>
                  <Badge
                    variant={cc.status === 'APPROVED' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {cc.status || 'active'}
                  </Badge>
                </div>
                <CardDescription>
                  {[char.race, char.class, char.level && `Level ${char.level}`]
                    .filter(Boolean)
                    .join(' · ')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {owner && (
                  <p className="text-xs text-muted-foreground">
                    Player: {owner.name || owner.email}
                  </p>
                )}
                {isDM && cc.status === 'PENDING' && (
                  <button
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() =>
                      approve.mutate({
                        campaignId,
                        campaignCharacterId: cc.id,
                      })
                    }
                  >
                    Approve character
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
