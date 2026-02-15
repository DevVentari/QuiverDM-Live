'use client';

import { Sidebar, MobileSidebar } from '@/components/sidebar';
import { UserMenu } from '@/components/user-menu';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingCheck>
      <NavigationProgress />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-border px-4 bg-card">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0">
                <div className="flex h-16 items-center px-4 border-b border-border">
                  <span className="font-display text-lg font-bold text-foreground">QuiverDM</span>
                </div>
                <MobileSidebar />
              </SheetContent>
            </Sheet>
            <div className="flex-1" />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </OnboardingCheck>
  );
}
