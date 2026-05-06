import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Bricolage_Grotesque, Cinzel, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { PostHogPageView } from '@/components/analytics/posthog-page-view';
import { AnalyticsErrorBoundary } from '@/components/analytics/error-boundary';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

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
      className={`${bricolage.variable} ${cinzel.variable} ${jetbrainsMono.variable}`}
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
