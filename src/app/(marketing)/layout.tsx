import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'QuiverDM — AI-Powered D&D Session Management',
    template: '%s | QuiverDM',
  },
  description: 'Stop taking notes. Start telling stories. QuiverDM is the AI-powered toolkit for Dungeon Masters — transcription, NPC management, homebrew extraction, and more.',
  keywords: ['D&D', 'Dungeons and Dragons', 'DM tools', 'session management', 'AI', 'transcription', 'NPC tracker'],
  openGraph: {
    type: 'website',
    siteName: 'QuiverDM',
    title: 'QuiverDM — AI-Powered D&D Session Management',
    description: 'Stop taking notes. Start telling stories. The AI-powered toolkit for Dungeon Masters.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuiverDM — AI-Powered D&D Session Management',
    description: 'Stop taking notes. Start telling stories. The AI-powered toolkit for Dungeon Masters.',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
