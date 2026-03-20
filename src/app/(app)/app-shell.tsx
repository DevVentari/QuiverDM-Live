'use client';

import { Sidebar, MobileSidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { CompendiumPanel } from '@/components/compendium/compendium-panel';
import { VideoBackground } from '@/components/video-background';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell';
import { VoiceButton } from '@/components/voice/voice-button';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CampaignVoiceShell>
    <OnboardingCheck>
      <NavigationProgress />
      {/* Atmospheric layers */}
      <VideoBackground />
      <div className="app-ambient-glow" />
      <div className="flex h-screen overflow-hidden app-grain app-vignette">
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
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <VoiceButton />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
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
