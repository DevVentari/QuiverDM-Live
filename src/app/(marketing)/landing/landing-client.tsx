'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Mic,
  BookOpen,
  Users,
  Swords,
  ChevronRight,
  Scroll,
  Sparkles,
  Shield,
  Zap,
  Star,
  ArrowRight,
  Check,
  Globe,
} from 'lucide-react';

// ─── Animation helpers ─────────────────────────────────────────────────────

function useFadeUp(reduced: boolean | null) {
  return {
    initial: reduced ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' },
  };
}

function useReveal(reduced: boolean | null) {
  return {
    initial: reduced ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 as const },
    transition: reduced ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' },
  };
}

const staggerContainer = (reduced: boolean | null) => ({
  animate: {
    transition: reduced ? {} : { staggerChildren: 0.1 },
  },
});

const staggerItem = (reduced: boolean | null) => ({
  initial: reduced ? {} : { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: reduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' },
});

// ─── Feature tabs data ──────────────────────────────────────────────────────

const FEATURE_TABS = [
  {
    id: 'recording',
    label: 'Session Recording',
    icon: Mic,
    title: 'Never Miss a Moment',
    bullets: [
      'AI-powered transcription with speaker diarization',
      'Automatic session summaries in seconds',
      'Shareable player recaps after every session',
      'Full transcript search across all sessions',
    ],
    preview: (
      <div className="rounded-lg border border-border/40 bg-black/20 p-4 space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-muted-foreground">Recording · Session 12</span>
        </div>
        {['DM: The dragon circles overhead...', 'Aria: I cast Counterspell!', 'DM: Roll Arcana...', 'Torvin: 19!'].map(
          (line, i) => (
            <div key={i} className="text-muted-foreground/80 leading-relaxed">
              <span className={i % 2 === 0 ? 'text-amber-400/80' : 'text-blue-400/80'}>
                {line.split(':')[0]}:
              </span>
              {line.split(':').slice(1).join(':')}
            </div>
          )
        )}
      </div>
    ),
  },
  {
    id: 'homebrew',
    label: 'Homebrew Library',
    icon: BookOpen,
    title: 'Your Content, Organized',
    bullets: [
      'Upload PDFs and extract content with AI',
      'Monsters, spells, items, and rules — all indexed',
      'Campaign-scoped homebrew with search',
      'DnD Beyond import support',
    ],
    preview: (
      <div className="rounded-lg border border-border/40 bg-black/20 p-4 space-y-2 text-xs">
        <div className="text-amber-400/70 font-medium mb-3">📚 Campaign Library</div>
        {[
          { type: 'Monster', name: 'Ashfell Wraith', cr: 'CR 7' },
          { type: 'Spell', name: 'Veilbind', cr: 'Lv 3' },
          { type: 'Item', name: 'Ember Blade', cr: 'Rare' },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded border border-border/30 bg-white/5 px-3 py-2"
          >
            <div>
              <span className="text-muted-foreground/50 text-[10px] uppercase tracking-wider">{item.type}</span>
              <div className="text-foreground/80">{item.name}</div>
            </div>
            <span className="text-amber-400/60 text-[10px]">{item.cr}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'npcs',
    label: 'NPC Tracking',
    icon: Users,
    title: 'Every Character Remembered',
    bullets: [
      'Full stat blocks with faction grouping',
      'DM-only secret notes hidden from players',
      'Relationship webs and motivation tracking',
      'Quick recall mid-session',
    ],
    preview: (
      <div className="rounded-lg border border-border/40 bg-black/20 p-4 space-y-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-600/30 to-amber-900/30 border border-amber-500/20 flex items-center justify-center text-base">
            👑
          </div>
          <div>
            <div className="font-medium text-foreground/90">Lord Varek</div>
            <div className="text-muted-foreground/60">Noble · Faction: Iron Council</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[['AC', '16'], ['HP', '104'], ['CR', '8']].map(([k, v]) => (
            <div key={k} className="rounded border border-border/30 bg-white/5 p-2 text-center">
              <div className="text-muted-foreground/50 text-[10px]">{k}</div>
              <div className="text-foreground/80 font-mono">{v}</div>
            </div>
          ))}
        </div>
        <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-400/70">
          🔒 DM Note: He is secretly the Crimson Hand&apos;s informant
        </div>
      </div>
    ),
  },
  {
    id: 'campaign',
    label: 'Campaign Tools',
    icon: Swords,
    title: 'Everything in One Place',
    bullets: [
      'Invite players with role-based permissions',
      'Encounter builder with CR calculator',
      'Session timeline and prep tasks',
      'Export and share campaign data',
    ],
    preview: (
      <div className="rounded-lg border border-border/40 bg-black/20 p-4 space-y-2 text-xs">
        <div className="text-amber-400/70 font-medium mb-3">⚔️ The Shattered Throne</div>
        <div className="space-y-1.5">
          {[
            { label: 'Sessions', value: '14 recorded', icon: '📜' },
            { label: 'NPCs', value: '23 tracked', icon: '👥' },
            { label: 'Homebrew', value: '41 items', icon: '📖' },
            { label: 'Players', value: '5 active', icon: '🎲' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded border border-border/30 bg-white/5 px-3 py-1.5"
            >
              <span className="text-muted-foreground/70">
                {row.icon} {row.label}
              </span>
              <span className="text-foreground/70">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function LandingClient() {
  const reduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState(0);

  const fadeUp = useFadeUp(reduced);
  const reveal = useReveal(reduced);

  return (
    <div className="flex flex-col min-h-screen landing-bg">
      {/* ── 1. Sticky Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/30 glass-shell">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/landing" className="font-display text-xl font-bold tracking-wide text-foreground hover:text-primary transition-colors">
            QuiverDM
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/auth/signin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/auth/signup">
                Get Started
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── 2. Hero ── */}
      <section className="relative flex flex-col items-center justify-center px-4 py-28 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,hsl(35_80%_55%/0.07),transparent)] pointer-events-none" />

        <motion.div className="relative z-10 max-w-4xl mx-auto" {...fadeUp}>
          {/* Eyebrow badge */}
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400 mb-8"
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.1 }}
          >
            <Sparkles className="h-3 w-3" />
            AI-Powered D&amp;D Session Management
          </motion.div>

          <motion.h1
            className="font-display font-bold tracking-tight text-fluid-4xl sm:text-5xl lg:text-7xl"
            initial={reduced ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          >
            Stop Taking Notes.
            <br />
            <span className="text-gradient-amber">Start Telling Stories.</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground sm:text-xl leading-relaxed"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          >
            The AI-powered toolkit for Dungeon Masters. Automatic transcription,
            NPC tracking, homebrew organization — so you can focus on the adventure.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.45, ease: 'easeOut' }}
          >
            <Button asChild size="lg" className="gap-2 text-base px-8 h-12 shadow-lg shadow-primary/20">
              <Link href="/auth/signup">
                Start Your Campaign
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 h-12 border-border/50 hover:border-primary/40">
              <Link href="/pricing">See How It Works</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── 3. Trust Bar ── */}
      <motion.section
        className="border-y border-border/30 py-5"
        {...reveal}
      >
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {[
              { icon: Shield, label: 'Built for DMs by DMs' },
              { icon: Zap, label: 'AI-Powered Transcription' },
              { icon: Scroll, label: '5e Compatible' },
              { icon: Globe, label: 'Privacy First' },
              { icon: Star, label: 'Free to Start' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary/70" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── 4. Feature Showcase (Tabbed) ── */}
      <section className="py-24 px-4">
        <div className="container max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" {...reveal}>
            <h2 className="font-display text-fluid-3xl font-bold mb-4">
              Everything a DM Needs
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              One tool to run your whole campaign — from prep to recap.
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            className="flex flex-wrap justify-center gap-2 mb-8"
            {...reveal}
          >
            {FEATURE_TABS.map((tab, i) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                    activeTab === i
                      ? 'border-primary/60 bg-primary/15 text-primary'
                      : 'border-border/40 bg-white/5 text-muted-foreground hover:border-border/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </motion.div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? {} : { opacity: 0, y: -12 }}
              transition={reduced ? { duration: 0 } : { duration: 0.25 }}
              className="rounded-xl border border-border/40 glass-panel overflow-hidden"
            >
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left: text */}
                <div className="p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    {(() => {
                      const Icon = FEATURE_TABS[activeTab].icon;
                      return <Icon className="h-6 w-6 text-primary" />;
                    })()}
                    <h3 className="font-display text-fluid-xl font-bold">
                      {FEATURE_TABS[activeTab].title}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {FEATURE_TABS[activeTab].bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right: mock preview */}
                <div className="p-6 flex items-center justify-center border-l border-border/30 bg-black/10">
                  <div className="w-full max-w-xs">
                    {FEATURE_TABS[activeTab].preview}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── 5. How It Works ── */}
      <section className="py-24 px-4 border-t border-border/30">
        <div className="container max-w-4xl mx-auto">
          <motion.div className="text-center mb-16" {...reveal}>
            <h2 className="font-display text-fluid-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From session start to post-game review in three steps.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px border-t border-dashed border-border/40" />

            {[
              {
                step: '01',
                icon: Mic,
                title: 'Record Your Session',
                desc: 'Hit record at the table. QuiverDM captures everything with your device mic — no special hardware needed.',
              },
              {
                step: '02',
                icon: Sparkles,
                title: 'AI Extracts Everything',
                desc: 'Transcription, speaker labels, NPC mentions, key moments — all pulled automatically while you focus on the game.',
              },
              {
                step: '03',
                icon: Scroll,
                title: 'Review & Play',
                desc: 'Browse your session timeline, share player recaps, update your NPC notes, and prep for next time.',
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={reduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.12, ease: 'easeOut' }}
                className="relative rounded-xl border border-border/40 glass-panel p-6 text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-primary/30 bg-primary/10 mb-4">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="absolute -top-3 right-4 font-display text-4xl font-bold text-border/30 select-none">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Testimonial / Quote ── */}
      <motion.section
        className="py-20 px-4"
        {...reveal}
      >
        <div className="container max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border/40 glass-panel p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(35_80%_55%/0.06),transparent)] pointer-events-none" />
            <div className="relative z-10">
              <div className="text-5xl text-primary/30 font-display leading-none mb-4">&ldquo;</div>
              <blockquote className="font-display text-fluid-xl font-bold leading-snug text-foreground/90 italic mb-6">
                Built for the DMs who want to focus on what matters — the story.
              </blockquote>
              <p className="text-sm text-muted-foreground">
                Spend less time on bookkeeping, more time on storytelling.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── 7. Final CTA ── */}
      <motion.section
        className="py-28 px-4 border-t border-border/30 relative overflow-hidden"
        {...reveal}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,hsl(35_80%_55%/0.09),transparent)] pointer-events-none" />
        <div className="container max-w-2xl mx-auto text-center relative z-10">
          <h2 className="font-display text-fluid-3xl font-bold mb-4">
            Ready to Level Up{' '}
            <span className="text-gradient-amber">Your Game?</span>
          </h2>
          <p className="text-muted-foreground mb-10 text-lg">
            Join QuiverDM and run better sessions starting tonight.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2 text-base px-8 h-12 shadow-lg shadow-primary/20">
              <Link href="/auth/signup">
                Start Your Campaign
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 h-12 border-border/50 hover:border-primary/40">
              <Link href="/pricing">Compare Plans</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ── 8. Footer ── */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Link href="/landing" className="font-display font-bold text-foreground/70 hover:text-foreground transition-colors">
            QuiverDM
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/auth/signin" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/auth/signup" className="hover:text-foreground transition-colors">Get Started</Link>
          </div>
          <p>© {new Date().getFullYear()} QuiverDM</p>
        </div>
      </footer>
    </div>
  );
}
