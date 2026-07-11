import type { Metadata } from 'next';
import { Newsreader, IBM_Plex_Mono, Caveat } from 'next/font/google';
import { Providers } from './providers';
import '../styles/globals.css';

// "The Manuscript" typefaces — serif body, mono labels, hand-written margin notes.
const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  variable: '--rf-font-serif',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--rf-font-mono',
  display: 'swap',
});
const hand = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--rf-font-hand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RecapForge',
  description: 'Forge your table\'s sessions into living chronicles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable} ${hand.variable}`}>
      <body className="rf">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
