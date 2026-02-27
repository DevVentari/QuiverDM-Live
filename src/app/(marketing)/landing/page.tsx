import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LandingClient } from './landing-client';

export const metadata: Metadata = {
  title: 'QuiverDM — Stop Taking Notes, Start Telling Stories',
  description:
    'AI-powered D&D session management. Automatic transcription, NPC tracking, homebrew content extraction, and campaign organization for Dungeon Masters.',
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return <LandingClient />;
}
