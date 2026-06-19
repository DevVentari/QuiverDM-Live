// src/components/campaign/CampaignForgeReveal.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Users, ScrollText, X } from 'lucide-react';
import type { ForgingState } from './forge-state';

const rise = (reduce: boolean) => ({
  initial: reduce ? {} : { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: reduce ? 0 : 0.6, ease: 'easeOut' as const },
});

function dismissKey(campaignId: string) { return `forge-dismissed:${campaignId}`; }

/** The living reveal: one human ask + seeded surfaces fading in as they finish. */
export function CampaignForgeReveal({
  campaignId, slug, state, shell = 'app',
}: { campaignId: string; slug: string; state: ForgingState; shell?: 'app' | 'v3' }) {
  const reduce = useReducedMotion() ?? false;
  const [dismissed, setDismissed] = useState(true); // default hidden until effect resolves

  // Route map per shell — v3 has no /members or /brain routes; party lives under
  // settings, NPCs under their own route.
  const base = shell === 'v3' ? `/v3/campaigns/${slug}` : `/campaigns/${slug}`;
  const href = {
    party: shell === 'v3' ? `${base}/settings` : `${base}/members`,
    sessions: `${base}/sessions`,
    npcs: shell === 'v3' ? `${base}/npcs` : `${base}/brain`,
  };

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey(campaignId)) === '1');
  }, [campaignId]);

  function dismiss() {
    localStorage.setItem(dismissKey(campaignId), '1');
    setDismissed(true);
  }

  const finished = state.allSettled && state.surfaces.party === 'ready';
  if (dismissed || finished) return null;

  const s = state.surfaces;

  return (
    <motion.section
      {...rise(reduce)}
      className="relative mx-auto mb-4 w-full max-w-2xl rounded-[16px] border border-[var(--q-amber-border)]/40 bg-[color-mix(in_oklab,var(--q-surface-utility)_82%,transparent)] p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-[var(--q-text-faint)] hover:text-[var(--q-text)]"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-2 text-[11px] text-[var(--q-amber)]">
        <Sparkles className="h-3.5 w-3.5" />
        {state.allSettled
          ? 'Your world is ready'
          : `The world is still settling… ${state.ready} of ${state.total} ready`}
      </div>

      {s.party === 'empty' && (
        <div className="mb-3 rounded-[12px] border border-[var(--q-amber-border)]/40 bg-[var(--q-amber-trace)] p-3.5">
          <p className="font-[var(--q-font-display)] text-sm text-[var(--q-amber)]">Your table is empty</p>
          <p className="mt-0.5 text-xs text-[var(--q-text-dim)]">
            The world is taking shape — but it needs players. Call your party to the table.
          </p>
          <Link
            href={href.party}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--q-amber)] px-3 py-1.5 text-xs font-semibold text-[oklch(0.18_0.02_60)]"
          >
            <Users className="h-3.5 w-3.5" /> Invite players
          </Link>
        </div>
      )}

      <div className="grid gap-2">
        {s.session0 === 'ready' && (
          <RevealCard reduce={reduce} href={href.sessions} lab="Session 0 · ready"
            title="Into the Mists" body="Your opening scene is written and waiting." />
        )}
        {s.tarokka === 'ready' && (
          <RevealCard reduce={reduce} href={href.sessions} lab="DM secret · ready"
            title="Madam Eva has spoken" body="The Tarokka reading set the campaign's spine. Tap to reveal." />
        )}
        {s.npcs === 'ready' && (
          <RevealCard reduce={reduce} href={href.npcs} lab="Cast · ready"
            title="Figures stir in the world" body="Seeded NPCs are ready in the campaign brain." />
        )}
        {(s.session0 === 'pending' || s.tarokka === 'pending' || s.npcs === 'pending') && (
          <div className="rounded-[12px] border border-dashed border-[var(--q-amber-border)]/30 p-3">
            <div className="text-[9.5px] uppercase tracking-[0.2em] text-[var(--q-amber)]/70">Forging…</div>
            <div className="mt-2 h-2 w-2/3 animate-pulse rounded bg-[var(--q-amber)]/20" />
            <div className="mt-2 h-2 w-2/5 animate-pulse rounded bg-[var(--q-amber)]/20" />
          </div>
        )}
      </div>
    </motion.section>
  );
}

function RevealCard({ reduce, href, lab, title, body }: {
  reduce: boolean; href: string; lab: string; title: string; body: string;
}) {
  return (
    <motion.div {...rise(reduce)}>
      <Link href={href} className="block rounded-[12px] border border-white/8 bg-white/[0.025] p-3 transition-colors hover:border-[var(--q-amber-border)]">
        <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.2em] text-[var(--q-text-faint)]">
          <ScrollText className="h-3 w-3" /> {lab}
        </div>
        <p className="mt-1 font-[var(--q-font-display)] text-sm text-[var(--q-text)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--q-text-dim)]">{body}</p>
      </Link>
    </motion.div>
  );
}
