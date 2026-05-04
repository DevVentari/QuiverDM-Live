'use client';

import { Sidebar, MobileSidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { CompendiumPanel } from '@/components/compendium/compendium-panel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell';
import { VoiceButton } from '@/components/voice/voice-button';
import { useHeaderStore } from '@/store/header-store';

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

            {slot ? (
              <div className="flex-1 flex items-center gap-3 min-w-0 mx-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-none mb-0.5" style={{ color: 'hsl(35 60% 45%)' }}>
                    {slot.label}
                  </p>
                  <p className="font-display text-sm font-bold truncate leading-tight" style={{ color: 'hsl(35 30% 90%)' }}>
                    {slot.title}
                  </p>
                </div>
                {slot.badge && (
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                      slot.badge.color === 'amber'
                        ? 'text-amber-400/80 border-amber-500/20 bg-amber-500/8'
                        : 'text-sky-400/80 border-sky-500/20 bg-sky-500/8'
                    }`}
                  >
                    {slot.badge.text}
                  </span>
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
      <CompendiumPanel />
    </OnboardingCheck>
    </CampaignVoiceShell>
  );
}
