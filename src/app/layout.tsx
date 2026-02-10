import type { Metadata } from 'next';
import { Inter, Cinzel } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '700'],
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
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
