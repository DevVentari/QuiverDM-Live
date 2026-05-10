import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Providers } from './providers';
import { PostHogPageView } from '@/components/analytics/posthog-page-view';
import { AnalyticsErrorBoundary } from '@/components/analytics/error-boundary';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuiverDM — AI-Powered D&D Session Management',
  description:
    'The ultimate toolkit for Dungeon Masters. Record sessions, manage NPCs, organize homebrew content, and let AI handle the bookkeeping.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={{
        '--font-bricolage': '"Bricolage Grotesque", system-ui, sans-serif',
        '--font-cinzel': '"Cinzel", Georgia, serif',
        '--font-mono': '"JetBrains Mono", Consolas, "Liberation Mono", monospace',
      } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AnalyticsErrorBoundary>
            {children}
          </AnalyticsErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
