'use client'

import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { NavigationProgress } from '@/components/navigation-progress'
import { FeedbackWidget } from '@/components/feedback/feedback-widget'
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture'
import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags'
import { OnboardingCheck } from '@/components/onboarding-check'
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell'
import { CommandRail } from '@/components/shell/CommandRail'
import { CommandBar } from '@/components/shell/CommandBar'
import { MobileHeader } from '@/components/shell/MobileHeader'
import { BrainSummon } from '@/components/shell/BrainSummon'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CampaignVoiceShell>
      <OnboardingCheck>
        <NavigationProgress />

        <div className="relative flex h-screen overflow-hidden">
          <CommandRail />

          <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
            <CommandBar />
            <MobileHeader />

            <main className="flex-1 overflow-y-auto">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>

        {/* Global overlays */}
        <BrainSummon />
        <FeedbackWidget />
        <ConsoleLogCapture />
        <PinnedItemFlags />
      </OnboardingCheck>
    </CampaignVoiceShell>
  )
}
