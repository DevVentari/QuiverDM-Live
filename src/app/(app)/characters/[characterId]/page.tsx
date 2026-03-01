'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trash2,
  ArrowLeft,
  Edit,
  RefreshCw,
  Shield,
  Wand2,
  Backpack,
  BookOpen,
  GraduationCap,
  ScrollText,
  FlaskConical,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { CharacterOverview } from './_components/CharacterOverview';
import { CharacterSpells } from './_components/CharacterSpells';
import { CharacterInventory } from './_components/CharacterInventory';
import { CharacterFeatures } from './_components/CharacterFeatures';
import { CharacterProficiencies } from './_components/CharacterProficiencies';
import { CharacterBackground } from './_components/CharacterBackground';
import { AddToCampaignDialog } from '@/components/character/AddToCampaignDialog';
import { ShortRestDialog } from '@/components/character/ShortRestDialog';
import { LongRestDialog } from '@/components/character/LongRestDialog';
import { CharacterHomebrewItems } from '@/components/character/CharacterHomebrewItems';
import { CharacterHomebrewSpells } from '@/components/character/CharacterHomebrewSpells';
import { CharacterHomebrewFeats } from '@/components/character/CharacterHomebrewFeats';
import { CharacterActiveEffects } from '@/components/character/CharacterActiveEffects';
import { HeroStatBar } from '@/components/character/HeroStatBar';
import { ResolvedStatsSummary } from '@/components/character/ResolvedStatsSummary';
import { useDiceRoller } from '@/hooks/use-dice-roller';

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const characterId = params.characterId as string;
  const { roll } = useDiceRoller();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const character = trpc.characters.getById.useQuery(
    { id: characterId },
    { staleTime: 120_000 }
  );
  const utils = trpc.useUtils();

  const deleteChar = trpc.characters.delete.useMutation({
    onSuccess: () => router.push('/characters'),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const syncChar = trpc.charactersDndBeyond.syncCharacter.useMutation({
    onSuccess: () => {
      utils.characters.getById.invalidate({ id: characterId });
      toast({ title: 'Synced', description: 'Character synced from D&D Beyond.' });
    },
    onError: (error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  const updateChar = trpc.characters.update.useMutation({
    onSuccess: () => {
      utils.characters.getById.invalidate({ id: characterId });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (character.isLoading) {
    return (
      <div className="max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-10 rounded-lg w-full max-w-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (character.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">
            {character.error?.message || 'An unexpected error occurred'}
          </p>
          <Button variant="outline" onClick={() => character.refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!character.data) {
    return <p className="text-destructive">Character not found</p>;
  }

  const data = character.data as any;
  const classes = data.classes as any[] | null;
  const hasDndBeyond = !!data.dndBeyondId;

  // Compute initiative for hero stat bar
  const rawChar = (data.rawData as any)?.data;
  const dexScore = (data.abilityScores as any)?.dex ?? 10;
  const initiative =
    typeof rawChar?.initiativeBonus === 'number'
      ? rawChar.initiativeBonus
      : Math.floor((dexScore - 10) / 2);

  // Build subtitle
  const parts: string[] = [];
  if (data.race) parts.push(data.race);
  if (classes && classes.length > 0) {
    const classStr = classes
      .map((c: any) => (c.subclass ? `${c.name} (${c.subclass})` : c.name))
      .join(' / ');
    parts.push(classStr);
  } else if (data.class) {
    parts.push(data.subclass ? `${data.class} (${data.subclass})` : data.class);
  }
  parts.push(`Level ${data.level}`);
  const subtitle = parts.join(' | ');
  const existingCampaignIds = (data.campaignCharacters ?? []).map((cc: any) => cc.campaignId);

  return (
    <div className="max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Hero Header — mirrors dashboard character card, scaled up */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent pointer-events-none" />
        <div className="flex">

          {/* Portrait — flush left, fills full card height */}
          <div className="relative w-28 sm:w-36 shrink-0">
            {data.portraitUrl ? (
              <Image
                src={data.portraitUrl}
                alt={data.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-950 to-blue-950 flex items-center justify-center">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            {/* Fade right edge into card bg */}
            <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent pointer-events-none" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-3">

            {/* Row 1: back button + action buttons */}
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" asChild className="-ml-1.5 h-8 w-8 shrink-0">
                <Link href="/characters">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                <AddToCampaignDialog
                  characterId={characterId}
                  existingCampaignIds={existingCampaignIds}
                  onAdded={() => utils.characters.getById.invalidate({ id: characterId })}
                />
                <ShortRestDialog
                  data={data}
                  onRoll={roll}
                  disabled={updateChar.isPending}
                  onFinish={async (patch) => {
                    await updateChar.mutateAsync({ id: characterId, ...patch });
                    toast({ title: 'Short rest complete' });
                  }}
                />
                <LongRestDialog
                  data={data}
                  disabled={updateChar.isPending}
                  onFinish={async (patch) => {
                    await updateChar.mutateAsync({ id: characterId, ...patch });
                    toast({ title: 'Long rest complete' });
                  }}
                />
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/characters/${characterId}/edit`}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Link>
                </Button>
                {hasDndBeyond && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncChar.mutate({ characterId })}
                    disabled={syncChar.isPending}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1 ${syncChar.isPending ? 'animate-spin' : ''}`}
                    />
                    Sync
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Row 2: name/subtitle */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-wide leading-tight">{data.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                {data.background && (
                  <Badge variant="outline" className="mt-1.5 border-primary/30 text-primary/80">
                    {data.background}
                  </Badge>
                )}
              </div>
            </div>

            {/* Row 3: HP / AC / Speed / Prof / Initiative — always visible */}
            <HeroStatBar
              hp={data.hitPoints ?? null}
              armorClass={data.armorClass ?? null}
              speed={data.speed ?? null}
              proficiencyBonus={data.proficiencyBonus ?? null}
              initiative={initiative}
              isUpdating={updateChar.isPending}
              onUpdateHp={async (next) => {
                await updateChar.mutateAsync({ id: characterId, hitPoints: next });
              }}
            />
            <ResolvedStatsSummary characterId={characterId} baseAc={data.armorClass ?? 10} />

          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="spells" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Spells</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Backpack className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="homebrew" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Homebrew</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="proficiencies" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Background</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <CharacterOverview
            data={data}
            onRoll={roll}
            isUpdating={updateChar.isPending}
            onUpdate={async (patch) => {
              await updateChar.mutateAsync({ id: characterId, ...patch });
            }}
          />
        </TabsContent>
        <TabsContent value="spells" className="mt-4">
          <CharacterSpells
            data={data}
            onRoll={roll}
            isUpdating={updateChar.isPending}
            onUpdate={async (patch) => {
              await updateChar.mutateAsync({ id: characterId, ...patch });
            }}
          />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <CharacterInventory
            data={data}
            isUpdating={updateChar.isPending}
            onUpdate={async (patch) => {
              await updateChar.mutateAsync({ id: characterId, ...patch });
            }}
          />
        </TabsContent>
        <TabsContent value="homebrew" className="mt-4">
          <div className="space-y-6">
            <CharacterActiveEffects
              characterId={characterId}
              abilityScores={data.abilityScores ?? null}
              armorClass={data.armorClass ?? null}
            />
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Items</h3>
              <CharacterHomebrewItems characterId={characterId} />
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Spells</h3>
              <CharacterHomebrewSpells characterId={characterId} />
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Feats</h3>
              <CharacterHomebrewFeats characterId={characterId} />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <CharacterFeatures data={data} />
        </TabsContent>
        <TabsContent value="proficiencies" className="mt-4">
          <CharacterProficiencies data={data} onRoll={roll} />
        </TabsContent>
        <TabsContent value="background" className="mt-4">
          <CharacterBackground data={data} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Character"
        description="Are you sure you want to delete this character? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteChar.mutate({ id: characterId })}
        loading={deleteChar.isPending}
      />
    </div>
  );
}
