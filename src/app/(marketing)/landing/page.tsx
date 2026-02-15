import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Scroll, Users, BookOpen, Swords } from 'lucide-react';

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/landing" className="font-display text-xl font-bold text-foreground">
            QuiverDM
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/auth/signin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Your Campaign, <span className="text-foreground">Organized</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          AI-powered session management for Dungeon Masters. Record sessions,
          track NPCs, manage homebrew content, and let AI handle the
          bookkeeping.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/auth/signup"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start Your Campaign
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border px-8 text-sm font-medium hover:bg-accent transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </section>

      <section className="border-t border-border/50 py-24">
        <div className="container">
          <h2 className="text-center font-display text-3xl font-bold mb-12">
            Everything a DM Needs
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Scroll className="h-8 w-8 text-muted-foreground" />}
              title="Session Recording"
              description="Record and transcribe your sessions with AI-powered speaker diarization."
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
              title="Homebrew Library"
              description="Upload PDFs, extract content with AI, and organize your custom creations."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
              title="NPC Tracking"
              description="Full stat blocks, faction grouping, and secret notes only the DM can see."
            />
            <FeatureCard
              icon={<Swords className="h-8 w-8 text-muted-foreground" />}
              title="Campaign Management"
              description="Invite players, manage roles, and keep everything in one place."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 py-24">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold">
            Ready to Level Up Your Game?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join QuiverDM and spend less time on bookkeeping, more time on storytelling.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border px-8 text-sm font-medium hover:bg-accent transition-colors"
            >
              Compare Plans
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>QuiverDM - AI-Powered D&D Session Management</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
