'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  Brain,
  Loader2,
  Mic,
  Scroll,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type OnboardingStep = 'welcome' | 'profile' | 'first_campaign' | 'complete';

const STEPS: OnboardingStep[] = ['welcome', 'profile', 'first_campaign', 'complete'];
const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  profile: 'Profile',
  first_campaign: 'Campaign',
  complete: 'Complete',
};

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                index < currentIndex
                  ? 'bg-primary'
                  : index === currentIndex
                  ? 'bg-foreground'
                  : 'bg-muted-foreground/30'
              }`}
            />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {STEP_LABELS[step]}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`h-px w-8 mb-4 transition-colors ${
                index < currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { toast } = useToast();
  const completeWelcome = trpc.onboarding.completeWelcome.useMutation({
    onSuccess: onNext,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Built for Dungeon Masters</CardTitle>
        <CardDescription className="text-base mt-2">
          QuiverDM is your world-state engine — not a productivity app that happens to handle D&amp;D.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">DM Brain</p>
              <p className="text-sm text-muted-foreground">
                Living world intelligence that tracks every entity, faction, and hook across your campaign.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mic className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Session Recording</p>
              <p className="text-sm text-muted-foreground">
                Automatic transcription and AI summaries after every session.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Scroll className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Prep Workspace</p>
              <p className="text-sm text-muted-foreground">
                AI-assisted session prep with brain context baked in.
              </p>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => completeWelcome.mutate()}
          disabled={completeWelcome.isPending}
        >
          {completeWelcome.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [dmExperience, setDmExperience] = useState('');

  const completeProfile = trpc.onboarding.completeProfile.useMutation({
    onSuccess: onNext,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    completeProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      dmExperience: dmExperience as 'new' | 'junior' | 'experienced' | 'veteran' || undefined,
    });
  }

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Set Up Your Profile</CardTitle>
        <CardDescription className="text-base mt-2">
          Tell us a bit about yourself. You can always change this later in settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="How the world will know you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">
              Bio{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="bio"
              placeholder="A few words about your tabletop experience..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dmExperience">How long have you been DMing?</Label>
            <select
              id="dmExperience"
              value={dmExperience}
              onChange={(e) => setDmExperience(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>Select your experience level</option>
              <option value="new">First campaign</option>
              <option value="junior">1–3 years</option>
              <option value="experienced">3–10 years</option>
              <option value="veteran">10+ years</option>
            </select>
          </div>

          {completeProfile.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {completeProfile.error.message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={completeProfile.isPending || !dmExperience}
          >
            {completeProfile.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Continue
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FirstCampaignStep({
  onNext,
  onSkip,
}: {
  onNext: (slug: string) => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [ddbCampaignUrl, setDdbCampaignUrl] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [storyText, setStoryText] = useState('');

  const { data: settingsData } = trpc.userSettings.getSettings.useQuery();
  const hasCobalt = settingsData?.hasDndBeyondCobaltCookie ?? false;

  const utils = trpc.useUtils();

  const completeFirstCampaign = trpc.onboarding.completeFirstCampaign.useMutation({
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createCampaign = trpc.campaigns.create.useMutation({
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const seedBrain = trpc.brain.seedFromCreation.useMutation();
  const importDDB = trpc.charactersDndBeyond.importFromCampaign.useMutation();

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isPending = createCampaign.isPending || completeFirstCampaign.isPending || seedBrain.isPending || importDDB.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignName.trim()) return;
    try {
      const campaign = await createCampaign.mutateAsync({
        name: campaignName.trim(),
        description: description.trim() || undefined,
      });

      void seedBrain.mutateAsync({
        campaignId: campaign.id,
        worldSetup: {
          startingLocation: startingLocation.trim() || undefined,
          antagonistName: antagonistName.trim() || undefined,
          openingHook: openingHook.trim() || undefined,
        },
        storyText: storyText.trim() || undefined,
      });

      if (hasCobalt && ddbCampaignUrl.trim()) {
        void importDDB.mutateAsync({
          campaignUrl: ddbCampaignUrl.trim(),
          campaignId: campaign.id,
        });
      }

      await completeFirstCampaign.mutateAsync();
      void utils.onboarding.needsOnboarding.invalidate();
      onNext(campaign.slug);
    } catch (error: unknown) {
      // createCampaign.error already set by tRPC — no extra toast needed
    }
  }

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Your First Campaign</CardTitle>
        <CardDescription className="text-base mt-2">
          Set the stage. The DM Brain will start building your world from here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campaign Identity</p>
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name *</Label>
              <Input
                id="campaignName"
                placeholder="e.g., Curse of Strahd, The Lost Mines"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="A brief summary of your campaign..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Party Import</p>
            {hasCobalt ? (
              <div className="space-y-2">
                <Label htmlFor="ddbCampaignUrl">DnD Beyond Campaign URL</Label>
                <Input
                  id="ddbCampaignUrl"
                  placeholder="https://www.dndbeyond.com/campaigns/..."
                  value={ddbCampaignUrl}
                  onChange={(e) => setDdbCampaignUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste your campaign URL to import linked character sheets.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium text-primary">Import your DnD Beyond party</p>
                <p className="text-sm text-muted-foreground">
                  Install the DnD Beyond extension and add your Cobalt Session cookie in{' '}
                  <a
                    href="/settings"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Settings → API Keys
                  </a>{' '}
                  to enable character import.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">World Setup</p>
            <div className="space-y-2">
              <Label htmlFor="startingLocation">Starting Location</Label>
              <Input
                id="startingLocation"
                placeholder="e.g., Barovia, Phandalin"
                value={startingLocation}
                onChange={(e) => setStartingLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="antagonistName">Main Antagonist</Label>
              <Input
                id="antagonistName"
                placeholder="e.g., Strahd von Zarovich, Nezznar the Black Spider"
                value={antagonistName}
                onChange={(e) => setAntagonistName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingHook">Opening Hook</Label>
              <Input
                id="openingHook"
                placeholder="e.g., The party receives a mysterious letter..."
                value={openingHook}
                onChange={(e) => setOpeningHook(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storyText">Story So Far</Label>
            <Textarea
              id="storyText"
              placeholder="Migrating from another tool? Paste your campaign history here and the DM Brain will extract it."
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              maxLength={20000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">{storyText.length}/20000</p>
          </div>

          {(createCampaign.error || completeFirstCampaign.error) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {createCampaign.error?.message ?? completeFirstCampaign.error?.message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending || !campaignName.trim()}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Create Campaign &amp; Continue
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CompleteStep({ campaignSlug }: { campaignSlug: string | null }) {
  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Brain className="h-12 w-12 text-primary animate-pulse" />
        </div>
        <CardTitle className="text-2xl">DM Brain is waking up</CardTitle>
        <CardDescription className="text-base mt-2">
          Your campaign is being processed. Entities, factions, and hooks will appear in the Brain as ingestion completes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaignSlug && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => { window.location.href = `/campaigns/${campaignSlug}/brain`; }}
          >
            <Brain className="mr-2 h-4 w-4" />
            Review Brain
          </Button>
        )}
        <Button
          className="w-full"
          size="lg"
          variant={campaignSlug ? 'outline' : 'default'}
          onClick={() => { window.location.href = '/dashboard'; }}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OnboardingPage() {
  const { data: status, isLoading, error } = trpc.onboarding.getStatus.useQuery(undefined, { staleTime: 300_000 });

  const [localStep, setLocalStep] = useState<OnboardingStep | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const currentStep = localStep ?? status?.currentStep ?? 'welcome';

  useEffect(() => {
    if (status?.completed && !localStep) {
      window.location.href = '/dashboard';
    }
  }, [status?.completed, localStep]);

  if (status?.completed && !localStep) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-lg w-full space-y-4">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = (error as any)?.data?.code === 'NOT_FOUND';
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">
              {isNotFound
                ? 'Your session is no longer valid.'
                : 'Failed to load onboarding status.'}
            </p>
            {isNotFound ? (
              <Button onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
                Sign in again
              </Button>
            ) : (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function advanceTo(step: OnboardingStep) {
    setLocalStep(step);
  }

  function handleSkipComplete() {
    window.location.href = '/dashboard';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <StepIndicator currentStep={currentStep} />

      {currentStep === 'welcome' && (
        <WelcomeStep onNext={() => advanceTo('profile')} />
      )}

      {currentStep === 'profile' && (
        <ProfileStep
          onNext={() => advanceTo('first_campaign')}
          onSkip={handleSkipComplete}
        />
      )}

      {currentStep === 'first_campaign' && (
        <FirstCampaignStep
          onNext={(slug) => {
            setCreatedSlug(slug);
            advanceTo('complete');
          }}
          onSkip={handleSkipComplete}
        />
      )}

      {currentStep === 'complete' && <CompleteStep campaignSlug={createdSlug} />}
    </div>
  );
}
