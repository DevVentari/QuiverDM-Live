'use client';

import { Sidebar, MobileSidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, ChevronsUpDown, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell';
import { VoiceButton } from '@/components/voice/voice-button';
import { useHeaderStore, type HeaderSlot } from '@/store/header-store';
import { trpc } from '@/lib/trpc';

function CampaignTitleDropdown({ slot }: { slot: NonNullable<HeaderSlot> & { campaignSlug: string } }) {
  const router = useRouter();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 300_000 });

  return (
    <div className="flex-1 flex items-center gap-4 min-w-0 mx-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="min-w-0 shrink-0 text-left flex items-end gap-1 hover:opacity-75 transition-opacity focus:outline-none">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-0.5" style={{ color: 'hsl(35 60% 45%)' }}>
                {slot.label}
              </p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-bold truncate leading-tight" style={{ color: 'hsl(35 30% 90%)' }}>
                  {slot.title}
                </p>
                <ChevronsUpDown className="h-3 w-3 shrink-0" style={{ color: 'hsl(35 20% 45%)' }} strokeWidth={1.8} />
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {campaigns.data?.map((c) => (
            <DropdownMenuItem
              key={c.slug}
              onClick={() => router.push(`/campaigns/${c.slug}`)}
              className="gap-2"
            >
              {c.slug === slot.campaignSlug
                ? <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                : <span className="w-3.5 shrink-0" />}
              <span className="truncate">{c.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/campaigns')}>
            All campaigns
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {slot.stats && slot.stats.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
          {slot.stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: stat.alert ? 'hsl(35 70% 55%)' : 'hsl(35 20% 65%)' }}
              >
                {stat.value}
              </span>
              <span className="text-[11px]" style={{ color: 'hsl(35 10% 40%)' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const slot = useHeaderStore((s) => s.slot);

  return (
    <CampaignVoiceShell>
    <OnboardingCheck>
      <NavigationProgress />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="glass-shell flex h-14 items-center justify-between border-b border-border px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" aria-label="Open navigation menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="glass-shell w-60 p-0 border-r border-border">
                <div className="flex h-16 items-center px-4 border-b border-border">
                  <span className="font-display text-lg font-bold text-foreground">QuiverDM</span>
                </div>
                <MobileSidebar />
              </SheetContent>
            </Sheet>

            {slot?.campaignSlug ? (
              <CampaignTitleDropdown slot={slot as NonNullable<HeaderSlot> & { campaignSlug: string }} />
            ) : slot ? (
              <div className="flex-1 flex items-center gap-4 min-w-0 mx-3">
                <div className="min-w-0 shrink-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-0.5" style={{ color: 'hsl(35 60% 45%)' }}>
                    {slot.label}
                  </p>
                  <p className="text-sm font-bold truncate leading-tight" style={{ color: 'hsl(35 30% 90%)' }}>
                    {slot.title}
                  </p>
                </div>

                {slot.stats && slot.stats.length > 0 && (
                  <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
                    {slot.stats.map((stat) => (
                      <div key={stat.label} className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: stat.alert ? 'hsl(35 70% 55%)' : 'hsl(35 20% 65%)' }}
                        >
                          {stat.value}
                        </span>
                        <span className="text-[11px]" style={{ color: 'hsl(35 10% 40%)' }}>
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex items-center gap-2">
              <VoiceButton />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] 2xl:max-w-[1800px] p-4 sm:p-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <ConsoleLogCapture />
      <FeedbackWidget />
      <PinnedItemFlags />
    </OnboardingCheck>
    </CampaignVoiceShell>
  );
}
