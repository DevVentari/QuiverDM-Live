import type { Metadata } from 'next';
import { Bricolage_Grotesque, Cinzel, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
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
  weight: ['400', '500', '600', '700'],
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
      <body className="relative min-h-screen overflow-hidden bg-background font-sans antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.68]"
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(5, 7, 12, 0.2), rgba(5, 7, 12, 0.76)), url('/backgrounds/quiverdm-atlas-v2.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(22,16,12,0.22)_82%,rgba(18,12,10,0.54)_100%),linear-gradient(180deg,rgba(20,13,10,0.08),rgba(14,9,8,0.42))]"
        />
        <div className="relative z-10 min-h-screen">
          <Providers>
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            <AnalyticsErrorBoundary>
              {children}
            </AnalyticsErrorBoundary>
          </Providers>
        </div>
      </body>
    </html>
  );
}
