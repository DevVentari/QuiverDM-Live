// src/components/campaign/useCampaignForging.ts
'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { deriveForgingState, type ForgingState } from './forge-state';

const POLL_MS = 2000;
const CAP_MS = 2500; // mist hard cap
const STOP_MS = 60000; // give up polling for seeds after this

/**
 * Derive live forging state for a freshly-created campaign. Polls scenes/NPCs/members
 * every 2s until all seeded surfaces are ready (or 60s elapses), then stops.
 */
export function useCampaignForging(campaignId: string, book: string | undefined): ForgingState {
  const [capReached, setCapReached] = useState(false);
  const [givenUp, setGivenUp] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const cap = setTimeout(() => setCapReached(true), CAP_MS);
    const stop = setTimeout(() => setGivenUp(true), STOP_MS);
    return () => { clearTimeout(cap); clearTimeout(stop); };
  }, []);

  const polling = !settled && !givenUp;
  const refetchInterval = polling ? POLL_MS : false;

  const scenesQuery = trpc.scenes.list.useQuery({ campaignId }, { refetchInterval });
  const npcsQuery = trpc.brain.entities.list.useQuery({ campaignId, type: 'NPC' }, { refetchInterval });
  const membersQuery = trpc.members.getAll.useQuery({ campaignId }, { refetchInterval });

  // Count PLAYER-role members only — getAll includes the OWNER (the creating DM),
  // so a raw length would never read as "table is empty" and the invite ask
  // (the one human action) would never surface.
  const partyCount = ((membersQuery.data ?? []) as Array<{ role?: string }>).filter(
    (m) => m.role === 'PLAYER',
  ).length;

  const state = deriveForgingState({
    scenes: (scenesQuery.data ?? []) as Array<{ promptInput?: unknown }>,
    npcCount: (npcsQuery.data ?? []).length,
    partyCount,
    book,
    capReached,
  });

  useEffect(() => {
    if (state.allSettled && !settled) setSettled(true);
  }, [state.allSettled, settled]);

  return state;
}
