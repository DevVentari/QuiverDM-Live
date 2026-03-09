import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { prisma } from '../prisma';
import { WorldEntityType, WorldStateChangeType, WorldStateChangeSource } from '@prisma/client';
import { brainRepository } from '../../server/repositories/brain.repository';

type HookUrgency = 'low' | 'medium' | 'high';

interface Hook {
  id: string;
  text: string;
  urgency: HookUrgency;
  status?: string;
  age?: number;
}

function ageToUrgency(age: number): HookUrgency {
  if (age >= 6) return 'high';
  if (age >= 3) return 'medium';
  return 'low';
}

async function processCampaign(campaignId: string) {
  const state = await brainRepository.getOrCreateState(campaignId);

  const hooks = (state.hooks as unknown as Hook[]) ?? [];

  const agedHooks = hooks.map((hook) => {
    if (hook.status === 'resolved') return hook;
    const newAge = (hook.age ?? 0) + 1;
    return { ...hook, age: newAge, urgency: ageToUrgency(newAge) };
  });

  const npcEntities = await brainRepository.findEntities(campaignId, {
    type: WorldEntityType.NPC,
  });

  for (const entity of npcEntities) {
    const recentChanges = await prisma.worldStateChange.findMany({
      where: {
        campaignId,
        entityId: entity.id,
        changeType: WorldStateChangeType.property_update,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const stressChanges = recentChanges.filter((c) => {
      const val = c.newValue as Record<string, unknown>;
      return (
        val &&
        typeof val === 'object' &&
        Object.keys(val).some((k) => k.toLowerCase().includes('stress'))
      );
    });

    if (stressChanges.length >= 2) {
      const extractStress = (change: (typeof stressChanges)[number]): number | null => {
        const val = change.newValue as Record<string, unknown>;
        const stressKey = Object.keys(val).find((k) => k.toLowerCase().includes('stress'));
        if (!stressKey) return null;
        const raw = val[stressKey];
        return typeof raw === 'number' ? raw : null;
      };

      const first = extractStress(stressChanges[stressChanges.length - 1]);
      const last = extractStress(stressChanges[0]);

      if (first !== null && last !== null) {
        const delta = last - first;
        if (Math.abs(delta) > 0.15) {
          const direction = delta > 0 ? 'rising' : 'falling';
          await brainRepository.logChange({
            campaignId,
            entityId: entity.id,
            changeType: WorldStateChangeType.property_update,
            newValue: { field: 'stress_drift', delta, direction, observationCount: stressChanges.length },
            triggerText: `Stress ${direction} over last ${stressChanges.length} observations (delta: ${delta.toFixed(2)})`,
            source: WorldStateChangeSource.inference,
          });
        }
      }
    }
  }

  await brainRepository.updateState(campaignId, {
    hooks: agedHooks,
    lastInferenceAt: new Date(),
  });
}

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });

  console.log(`[brain-inference] Processing ${campaigns.length} active campaigns`);

  for (const campaign of campaigns) {
    try {
      await processCampaign(campaign.id);
      console.log(`[brain-inference] Done: ${campaign.name}`);
    } catch (err) {
      console.error(`[brain-inference] Error for campaign ${campaign.id}:`, err);
    }
  }

  await prisma.$disconnect();
  console.log('[brain-inference] Complete');
}

main().catch((err) => {
  console.error('[brain-inference] Fatal:', err);
  process.exit(1);
});
