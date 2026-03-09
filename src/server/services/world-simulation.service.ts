import { authz } from './authorization.service';
import { ForbiddenError, NotFoundError } from '../errors';
import { worldSimulationRepository } from '../repositories/world-simulation.repository';
import { brainRepository } from '../repositories/brain.repository';
import { chatWithAI } from '@/lib/ai/chat';
import { buildWorldSimulationPrompt } from '@/lib/ai/world-simulation-prompts';

export class WorldSimulationService {
  private async requireDM(campaignId: string, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage', 'World Simulation');
    }
    return access;
  }

  async runWorldTick(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);

    const [actors, worldState] = await Promise.all([
      worldSimulationRepository.listActors(campaignId),
      brainRepository.getOrCreateState(campaignId),
    ]);

    if (actors.length === 0) {
      return { eventsCreated: 0, thresholdTriggered: false };
    }

    const entities = await brainRepository.findEntities(campaignId, { limit: 100 });
    const prompt = buildWorldSimulationPrompt(actors, { worldState, entities });

    let raw: string;
    try {
      raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.7 });
    } catch {
      return { eventsCreated: 0, thresholdTriggered: false };
    }

    let parsed: Array<{ actorId?: string; type: string; description: string; causalChain?: unknown[] }>;
    try {
      parsed = parseSimulationResponse(raw);
    } catch {
      return { eventsCreated: 0, thresholdTriggered: false };
    }

    let eventsCreated = 0;
    for (const event of parsed.slice(0, 4)) {
      if (!event.type || !event.description) continue;
      await worldSimulationRepository.createEvent(campaignId, {
        actorId: event.actorId,
        type: event.type,
        description: event.description,
        causalChain: event.causalChain,
      });
      eventsCreated++;
    }

    const pressures = [
      worldState.pressurePolitical,
      worldState.pressureSupernatural,
      worldState.pressureEconomic,
      worldState.pressureCosmic,
      worldState.pressureSocial,
    ];
    let thresholdTriggered = false;
    if (pressures.some(p => p > 0.8)) {
      const highPressure = ['political', 'supernatural', 'economic', 'cosmic', 'social'].filter(
        (_, i) => pressures[i] > 0.8
      );
      await worldSimulationRepository.createEvent(campaignId, {
        type: 'threshold_trigger',
        description: `Critical pressure threshold exceeded: ${highPressure.join(', ')}. The world teeters on the edge of major change.`,
        causalChain: [{ trigger: 'pressure_threshold', tracks: highPressure }],
      });
      eventsCreated++;
      thresholdTriggered = true;
    }

    await Promise.all(actors.map(a => worldSimulationRepository.updateActorLastTickAt(a.id)));

    return { eventsCreated, thresholdTriggered };
  }

  async getSessionSeed(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return worldSimulationRepository.getSessionSeed(campaignId, 3);
  }

  async upsertActor(campaignId: string, entityId: string, userId: string, data: {
    goals?: string[];
    urgency?: number;
    resources?: Record<string, unknown>;
    riskTolerance?: number;
  }) {
    await this.requireDM(campaignId, userId);
    return worldSimulationRepository.upsertActor(campaignId, entityId, data);
  }

  async listActors(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return worldSimulationRepository.listActors(campaignId);
  }

  async deleteActor(campaignId: string, actorId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const actors = await worldSimulationRepository.listActors(campaignId);
    const actor = actors.find(a => a.id === actorId);
    if (!actor) {
      throw new NotFoundError('worldActor', actorId);
    }
    return worldSimulationRepository.deleteActor(actorId);
  }
}

function parseSimulationResponse(raw: string): Array<{ actorId?: string; type: string; description: string; causalChain?: unknown[] }> {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

export const worldSimulationService = new WorldSimulationService();
