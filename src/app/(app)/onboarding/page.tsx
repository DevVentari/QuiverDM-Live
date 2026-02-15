'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  BookOpen,
  Loader2,
  Plus,
  Users,
  CheckCircle2,
  Scroll,
  Sparkles,
  Mic,
} from 'lucide-react';

type OnboardingStep = 'welcome' | 'profile' | 'first_campaign' | 'complete';

const STEPS: OnboardingStep[] = ['welcome', 'profile', 'first_campaign', 'complete'];

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              index < currentIndex
                ? 'bg-primary'
                : index === currentIndex
                ? 'bg-foreground'
                : 'bg-muted-foreground/30'
            }`}
          />
          {index < STEPS.length - 1 && (
            <div
              className={`h-px w-8 transition-colors ${
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
  const completeWelcome = trpc.onboarding.completeWelcome.useMutation({
    onSuccess: onNext,
  });

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to QuiverDM</CardTitle>
        <CardDescription className="text-base mt-2">
          Your AI-powered companion for running tabletop RPG sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Scroll className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Manage Campaigns</p>
              <p className="text-sm text-muted-foreground">
                Organize your sessions, NPCs, players, and homebrew content in one place.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mic className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Record and Transcribe</p>
              <p className="text-sm text-muted-foreground">
                Automatically transcribe your sessions with speaker identification.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">AI-Powered Extraction</p>
              <p className="text-sm text-muted-foreground">
                Import homebrew PDFs and let AI extract monsters, spells, and items.
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
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  const completeProfile = trpc.onboarding.completeProfile.useMutation({
    onSuccess: onNext,
  });

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    completeProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
    });
  }

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Set Up Your Profile</CardTitle>
        <CardDescription className="text-base mt-2">
          Tell us a bit about yourself. You can always change this later in
          settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="How other players will see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">
              Bio{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="bio"
              placeholder="A few words about your tabletop experience..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/500
            </p>
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
            disabled={completeProfile.isPending}
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
  onNext: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [campaignName, setCampaignName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const completeFirstCampaign = trpc.onboarding.completeFirstCampaign.useMutation({
    onSuccess: onNext,
  });

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      completeFirstCampaign.mutate();
    },
  });

  const acceptInvite = trpc.members.acceptInvite.useMutation({
    onSuccess: () => {
      completeFirstCampaign.mutate();
    },
  });

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
  });

  const isPending =
    createCampaign.isPending ||
    acceptInvite.isPending ||
    completeFirstCampaign.isPending;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (campaignName.trim()) {
      createCampaign.mutate({ name: campaignName.trim() });
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (inviteCode.trim()) {
      acceptInvite.mutate({ code: inviteCode.trim() });
    }
  }

  if (mode === 'choose') {
    return (
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Your First Campaign</CardTitle>
          <CardDescription className="text-base mt-2">
            Campaigns are where you organize sessions, NPCs, and everything else
            for your game.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-foreground/50 transition-colors text-left"
            onClick={() => setMode('create')}
          >
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Create a Campaign</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Start a new campaign as Dungeon Master. Invite players later.
              </p>
            </div>
          </button>

          <button
            type="button"
            className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-foreground/50 transition-colors text-left"
            onClick={() => setMode('join')}
          >
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Join a Campaign</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Enter an invite code from your DM to join an existing campaign.
              </p>
            </div>
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'create') {
    return (
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create a Campaign</CardTitle>
          <CardDescription className="text-base mt-2">
            Give your campaign a name. You can add details later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                placeholder="e.g., Curse of Strahd, The Lost Mines"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
              />
            </div>

            {createCampaign.error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {createCampaign.error.message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Campaign
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMode('choose')}
                disabled={isPending}
              >
                Back
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // mode === 'join'
  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Join a Campaign</CardTitle>
        <CardDescription className="text-base mt-2">
          Enter the invite code you received from your Dungeon Master.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="font-mono"
              required
            />
          </div>

          {acceptInvite.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {acceptInvite.error.message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Join Campaign
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMode('choose')}
              disabled={isPending}
            >
              Back
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CompleteStep() {
  const router = useRouter();

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">You&apos;re All Set</CardTitle>
        <CardDescription className="text-base mt-2">
          Your account is ready. Here is what you can do next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Import Homebrew Content</p>
              <p className="text-sm text-muted-foreground">
                Upload PDFs of your homebrew monsters, spells, and items.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Invite Your Players</p>
              <p className="text-sm text-muted-foreground">
                Share an invite code so your party can join the campaign.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mic className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Record a Session</p>
              <p className="text-sm text-muted-foreground">
                Start recording to automatically transcribe your gameplay.
              </p>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: status, isLoading, error } = trpc.onboarding.getStatus.useQuery();

  const [localStep, setLocalStep] = useState<OnboardingStep | null>(null);

  // Determine which step to show
  const currentStep = localStep ?? status?.currentStep ?? 'welcome';

  // If onboarding is already completed and no local override, redirect to dashboard
  if (status?.completed && !localStep) {
    router.push('/dashboard');
    return null;
  }

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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">
              Failed to load onboarding status.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function advanceTo(step: OnboardingStep) {
    setLocalStep(step);
  }

  function handleSkipComplete() {
    router.push('/dashboard');
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
          onNext={() => advanceTo('complete')}
          onSkip={handleSkipComplete}
        />
      )}

      {currentStep === 'complete' && <CompleteStep />}
    </div>
  );
}
