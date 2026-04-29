'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronUp,
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
    <div className="flex items-center justify-center gap-3 mb-10">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full transition-all duration-300"
              style={{
                background:
                  index < currentIndex
                    ? 'hsl(35 80% 55%)'
                    : index === currentIndex
                    ? 'hsl(35 15% 88%)'
                    : 'hsl(240 10% 25%)',
                boxShadow: index === currentIndex ? '0 0 8px hsl(35 80% 55% / 0.4)' : 'none',
              }}
            />
            <span
              className="text-[9px] font-medium tracking-widest uppercase hidden sm:block"
              style={{
                color:
                  index <= currentIndex
                    ? 'hsl(35 30% 55%)'
                    : 'hsl(240 10% 35%)',
              }}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className="h-px w-10 mb-4 transition-all duration-300"
              style={{
                background:
                  index < currentIndex
                    ? 'linear-gradient(90deg, hsl(35 80% 55% / 0.5), hsl(35 80% 55% / 0.2))'
                    : 'hsl(240 10% 20%)',
              }}
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
    <div className="stone-card max-w-md w-full mx-auto glass-grain">
      <div className="stone-card-header">
        <span className="stone-card-title">Welcome to QuiverDM</span>
      </div>
      <div className="stone-card-body space-y-6 p-6">
        <div>
          <h2
            className="font-display text-xl font-bold mb-1"
            style={{ color: 'hsl(35 15% 88%)' }}
          >
            Built for Dungeon Masters
          </h2>
          <div className="section-rule" />
          <p className="text-sm" style={{ color: 'hsl(35 10% 50%)' }}>
            Not a productivity app. A world-state engine — your second brain at the table.
          </p>
        </div>

        <div className="space-y-2">
          {[
            {
              icon: <Brain className="h-4 w-4" style={{ color: 'hsl(35 80% 55%)' }} />,
              label: 'DM Brain',
              desc: 'Living world intelligence. Every entity, faction, and hook tracked across sessions.',
            },
            {
              icon: <Mic className="h-4 w-4" style={{ color: 'hsl(240 15% 50%)' }} />,
              label: 'Session Recording',
              desc: 'Automatic transcription and AI summaries after every session.',
            },
            {
              icon: <Scroll className="h-4 w-4" style={{ color: 'hsl(240 15% 50%)' }} />,
              label: 'Prep Workspace',
              desc: 'AI-assisted session prep with campaign context baked in.',
            },
          ].map(({ icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3 rounded-sm"
              style={{ background: 'hsl(240 10% 8% / 0.6)', border: '1px solid hsl(35 35% 15%)' }}
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(35 15% 80%)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(35 10% 45%)' }}>{desc}</p>
              </div>
            </div>
          ))}
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
      </div>
    </div>
  );
}

function ProfileStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
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
      dmExperience: dmExperience as 'new' | 'junior' | 'experienced' | 'veteran' || undefined,
    });
  }

  return (
    <div className="stone-card max-w-md w-full mx-auto glass-grain">
      <div className="stone-card-header">
        <span className="stone-card-title">Your Profile</span>
      </div>
      <div className="stone-card-body p-6">
        <div className="mb-5">
          <h2
            className="font-display text-xl font-bold mb-1"
            style={{ color: 'hsl(35 15% 88%)' }}
          >
            A Little About You
          </h2>
          <div className="section-rule" />
          <p className="text-sm" style={{ color: 'hsl(35 10% 50%)' }}>
            Quick setup — you can always change this in settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="displayName" className="label-overline block">Display Name</label>
            <Input
              id="displayName"
              placeholder="How the realm will know you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dmExperience" className="label-overline block">DM Experience</label>
            <Select value={dmExperience} onValueChange={setDmExperience}>
              <SelectTrigger id="dmExperience">
                <SelectValue placeholder="How long have you been DMing?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">First campaign</SelectItem>
                <SelectItem value="junior">1–3 years</SelectItem>
                <SelectItem value="experienced">3–10 years</SelectItem>
                <SelectItem value="veteran">10+ years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {completeProfile.error && (
            <div className="rounded-sm p-3 text-sm" style={{ background: 'hsl(0 60% 20% / 0.3)', border: '1px solid hsl(0 60% 35% / 0.3)', color: 'hsl(0 70% 70%)' }}>
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
              className="text-xs transition-colors"
              style={{ color: 'hsl(35 10% 40%)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'hsl(35 10% 60%)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'hsl(35 10% 40%)')}
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [storyText, setStoryText] = useState('');

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

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isPending = createCampaign.isPending || completeFirstCampaign.isPending || seedBrain.isPending;

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

      await completeFirstCampaign.mutateAsync();
      void utils.onboarding.needsOnboarding.invalidate();
      onNext(campaign.slug);
    } catch {
      // createCampaign.error already set by tRPC
    }
  }

  return (
    <div className="stone-card max-w-md w-full mx-auto glass-grain">
      <div className="stone-card-header">
        <span className="stone-card-title">First Campaign</span>
      </div>
      <div className="stone-card-body p-6">
        <div className="mb-5">
          <h2
            className="font-display text-xl font-bold mb-1"
            style={{ color: 'hsl(35 15% 88%)' }}
          >
            Set the Stage
          </h2>
          <div className="section-rule" />
          <p className="text-sm" style={{ color: 'hsl(35 10% 50%)' }}>
            Name your campaign. The DM Brain will start building from here.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="campaignName" className="label-overline block">Campaign Name *</label>
            <Input
              id="campaignName"
              placeholder="e.g., Curse of Strahd, The Lost Mines"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="label-overline block">
              Description <span style={{ color: 'hsl(240 10% 35%)' }}>(optional)</span>
            </label>
            <Textarea
              id="description"
              placeholder="A brief summary of your campaign..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs transition-colors w-full pt-1"
            style={{ color: 'hsl(35 60% 50%)' }}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAdvanced ? 'Hide world setup' : 'Add world setup (starting location, antagonist…)'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div
                className="h-px w-full"
                style={{ background: 'linear-gradient(90deg, hsl(35 80% 55% / 0.15), transparent)' }}
              />
              <div className="space-y-1.5">
                <label htmlFor="startingLocation" className="label-overline block">Starting Location</label>
                <Input
                  id="startingLocation"
                  placeholder="e.g., Barovia, Phandalin"
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="antagonistName" className="label-overline block">Main Antagonist</label>
                <Input
                  id="antagonistName"
                  placeholder="e.g., Strahd von Zarovich"
                  value={antagonistName}
                  onChange={(e) => setAntagonistName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="openingHook" className="label-overline block">Opening Hook</label>
                <Input
                  id="openingHook"
                  placeholder="e.g., The party receives a mysterious letter..."
                  value={openingHook}
                  onChange={(e) => setOpeningHook(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="storyText" className="label-overline block">Story So Far</label>
                <Textarea
                  id="storyText"
                  placeholder="Migrating from another tool? Paste your campaign history and the DM Brain will extract it."
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  maxLength={20000}
                  rows={3}
                />
                <p className="text-right text-xs" style={{ color: 'hsl(240 10% 35%)' }}>{storyText.length}/20000</p>
              </div>
            </div>
          )}

          {(createCampaign.error || completeFirstCampaign.error) && (
            <div className="rounded-sm p-3 text-sm" style={{ background: 'hsl(0 60% 20% / 0.3)', border: '1px solid hsl(0 60% 35% / 0.3)', color: 'hsl(0 70% 70%)' }}>
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
            Create Campaign
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-xs transition-colors"
              style={{ color: 'hsl(35 10% 40%)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'hsl(35 10% 60%)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'hsl(35 10% 40%)')}
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteStep({ campaignSlug }: { campaignSlug: string | null }) {
  return (
    <div className="stone-card max-w-md w-full mx-auto glass-grain">
      <div className="stone-card-header">
        <span className="stone-card-title">You&apos;re in</span>
      </div>
      <div className="stone-card-body p-6 space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: 'hsl(35 80% 55% / 0.1)', border: '1px solid hsl(35 80% 55% / 0.25)' }}
            >
              <Brain className="h-7 w-7" style={{ color: 'hsl(35 80% 62%)' }} />
            </div>
          </div>
          <div>
            <h2
              className="font-display text-xl font-bold mb-1"
              style={{ color: 'hsl(35 15% 88%)' }}
            >
              The Brain is Waking
            </h2>
            <div className="section-rule" />
            <p className="text-sm" style={{ color: 'hsl(35 10% 50%)' }}>
              {campaignSlug
                ? 'Your campaign is being processed. Entities, factions, and hooks will appear as ingestion completes.'
                : 'Your account is ready. Create a campaign any time to activate the DM Brain.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {campaignSlug && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => { window.location.href = `/campaigns/${campaignSlug}/brain`; }}
            >
              <Brain className="mr-2 h-4 w-4" />
              Open DM Brain
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
        </div>
      </div>
    </div>
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
      </div>
    );
  }

  if (error) {
    const isNotFound = (error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND';
    return (
      <div className="flex items-center justify-center">
        <div className="stone-card max-w-sm w-full mx-auto">
          <div className="stone-card-body p-6 text-center space-y-4">
            <p className="text-sm" style={{ color: 'hsl(0 70% 65%)' }}>
              {isNotFound ? 'Your session is no longer valid.' : 'Failed to load onboarding status.'}
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
          </div>
        </div>
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
    <div className="flex flex-col items-center">
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
