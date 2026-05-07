'use client';

import { MobileSidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell';
import { VoiceButton } from '@/components/voice/voice-button';
import { CommandRail } from '@/components/layout/command-rail';
import { CommandBar } from '@/components/layout/command-bar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CampaignVoiceShell>
    <OnboardingCheck>
      <NavigationProgress />
      <div className="flex h-screen overflow-hidden">
        <CommandRail />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <header className="md:hidden glass-shell flex h-14 items-center justify-between border-b border-border px-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open navigation menu">
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
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <VoiceButton />
              <UserMenu />
            </div>
          </header>
          {/* Desktop command bar */}
          <div className="hidden md:block">
            <CommandBar />
          </div>
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
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
