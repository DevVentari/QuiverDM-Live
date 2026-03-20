import { authz } from './authorization.service';
import { encounterPlanRepository } from '../repositories/encounter-plan.repository';
import { encounterRepository } from '../repositories/encounter.repository';
import { prisma } from '../db';
import { ForbiddenError, NotFoundError } from '../errors';
import { generateEncounter, type EncounterGenerationRequest } from '../../lib/ai/encounter-generator';
import { calculateDifficulty, getXpBudget, xpForCr } from '../../lib/dnd5e/encounter-calculator';
import { getMonsterBySlug } from '../../lib/srd/monsters';
import type { EncounterDifficulty } from '../../lib/ai/encounter-generator';

export class EncounterPlanService {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async getByCampaign(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    return encounterPlanRepository.findByCampaign(campaignId);
  }

  async getById(planId: string, userId: string) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);
    await authz.campaign(plan.campaignId, userId).verify();
    return plan;
  }

  // -------------------------------------------------------------------------
  // Create / Update / Delete plans
  // -------------------------------------------------------------------------

  async create(
    campaignId: string,
    userId: string,
    data: {
      name: string;
      partySize?: number;
      partyLevel?: number;
      difficulty?: string;
    }
  ) {
    const access = await authz.campaign(campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('create encounter plans', 'campaign');
    }
    return encounterPlanRepository.create({ campaignId, ...data });
  }

  async update(
    planId: string,
    userId: string,
    data: {
      name?: string;
      sceneDescription?: string;
      tacticalNotes?: string;
      environmentalEffects?: string;
      portraitUrl?: string;
      difficulty?: string;
      partySize?: number;
      partyLevel?: number;
    }
  ) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('edit encounter plans', 'campaign');
    }

    return encounterPlanRepository.update(planId, data);
  }

  async delete(planId: string, userId: string) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('delete encounter plans', 'campaign');
    }

    await encounterPlanRepository.delete(planId);
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // AI generation
  // -------------------------------------------------------------------------

  async generate(
    campaignId: string,
    userId: string,
    input: {
      name: string;
      userPrompt: string;
      partySize: number;
      partyLevel: number;
      difficulty: EncounterDifficulty;
    }
  ) {
    const access = await authz.campaign(campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('generate encounters', 'campaign');
    }

    // Fetch campaign NPCs for context
    const prismaAny = prisma as any;
    const npcs = await prismaAny.nPC.findMany({
      where: { campaignId },
      select: { id: true, name: true, stats: true },
      take: 20,
    });

    // Fetch campaign homebrew creatures
    const homebrewCreatures = await prismaAny.campaignHomebrewContent.findMany({
      where: { campaignId, homebrew: { type: 'creature' } },
      include: { homebrew: { select: { id: true, name: true, data: true } } },
      take: 10,
    });

    const request: EncounterGenerationRequest = {
      userPrompt: input.userPrompt,
      partySize: input.partySize,
      partyLevel: input.partyLevel,
      difficulty: input.difficulty,
      campaignNpcs: npcs.map((n: { id: string; name: string; stats: Record<string, unknown> | null }) => ({
        id: n.id,
        name: n.name,
        cr: n.stats?.challengeRating as string | undefined,
        stats: n.stats as Record<string, unknown> | undefined,
      })),
      homebrewCreatures: homebrewCreatures.map((hc: { homebrew: { id: string; name: string; data: Record<string, unknown> | null } }) => ({
        id: hc.homebrew.id,
        name: hc.homebrew.name,
        data: hc.homebrew.data as Record<string, unknown> | undefined,
      })),
    };

    const result = await generateEncounter(request);

    if (!result.success) {
      throw new Error(result.error ?? 'AI generation failed');
    }

    // Calculate XP stats
    const creaturesForCalc = result.creatures.map((c) => ({
      xp: c.xp,
      count: c.count,
    }));
    const budget = getXpBudget(input.partySize, input.partyLevel, input.difficulty);
    const diffResult =
      creaturesForCalc.length > 0
        ? calculateDifficulty(creaturesForCalc, input.partySize, input.partyLevel)
        : null;

    // Create the plan + creatures in a transaction
    const plan = await encounterPlanRepository.create({
      campaignId,
      name: input.name,
      aiPrompt: input.userPrompt,
      sceneDescription: result.sceneDescription,
      tacticalNotes: result.tacticalNotes,
      difficulty: input.difficulty,
      partySize: input.partySize,
      partyLevel: input.partyLevel,
      xpBudget: budget.target,
      totalXp: diffResult?.rawXp,
      adjustedXp: diffResult?.adjustedXp,
    });

    // Attach SRD stat blocks to generated creatures
    for (const creature of result.creatures) {
      let statBlock: Record<string, unknown> | undefined = creature.statBlock;

      if (creature.sourceType === 'srd' && !statBlock) {
        // Try to find stat block from bundled SRD data
        const slug = creature.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const srdMonster = getMonsterBySlug(slug);
        if (srdMonster) {
          statBlock = srdMonster as unknown as Record<string, unknown>;
        }
      }

      await encounterPlanRepository.addCreature({
        planId: plan.id,
        name: creature.name,
        count: creature.count,
        cr: creature.cr,
        xp: creature.xp,
        sourceType: creature.sourceType,
        sourceId: creature.sourceId,
        statBlock,
      });
    }

    return encounterPlanRepository.findById(plan.id);
  }

  // -------------------------------------------------------------------------
  // Creature management
  // -------------------------------------------------------------------------

  async addCreature(
    planId: string,
    userId: string,
    data: {
      name: string;
      count: number;
      cr?: string;
      xp?: number;
      sourceType: 'srd' | 'npc' | 'homebrew' | 'custom';
      sourceId?: string;
      statBlock?: Record<string, unknown>;
    }
  ) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('edit encounter plans', 'campaign');
    }

    // Auto-fill XP from CR if not provided
    let xp = data.xp;
    if (xp === undefined && data.cr) {
      xp = xpForCr(data.cr);
    }

    const creature = await encounterPlanRepository.addCreature({ ...data, planId, xp });

    // Recalculate XP totals
    await this.recalculateXp(planId, plan);

    return creature;
  }

  async removeCreature(creatureId: string, userId: string) {
    const prismaAny = prisma as any;
    const creature = await prismaAny.encounterPlanCreature.findUnique({
      where: { id: creatureId },
      select: { planId: true },
    });
    if (!creature) throw new NotFoundError('creature', creatureId);

    const plan = await encounterPlanRepository.findById(creature.planId);
    if (!plan) throw new NotFoundError('encounter plan', creature.planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('edit encounter plans', 'campaign');
    }

    await encounterPlanRepository.removeCreature(creatureId);
    await this.recalculateXp(creature.planId, plan);

    return { success: true };
  }

  async updateCreature(
    creatureId: string,
    userId: string,
    data: { count?: number; name?: string; cr?: string; xp?: number; statBlock?: Record<string, unknown> }
  ) {
    const prismaAny = prisma as any;
    const creature = await prismaAny.encounterPlanCreature.findUnique({
      where: { id: creatureId },
      select: { planId: true },
    });
    if (!creature) throw new NotFoundError('creature', creatureId);

    const plan = await encounterPlanRepository.findById(creature.planId);
    if (!plan) throw new NotFoundError('encounter plan', creature.planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('edit encounter plans', 'campaign');
    }

    const updated = await encounterPlanRepository.updateCreature(creatureId, data);
    await this.recalculateXp(creature.planId, plan);
    return updated;
  }

  async getBySourcebook(campaignId: string) {
    return encounterPlanRepository.getBySourcebook(campaignId);
  }

  async markAsRun(planId: string, userId: string, sessionId?: string) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);
    const campaignOwnerId = (plan as any).campaign?.userId;
    if (campaignOwnerId !== userId) throw ForbiddenError.forPermission('mark as run', 'encounter plan');
    return encounterPlanRepository.markAsRun(planId, sessionId);
  }

  // -------------------------------------------------------------------------
  // Launch to Tracker
  // -------------------------------------------------------------------------

  async launchToTracker(planId: string, sessionId: string, userId: string) {
    const plan = await encounterPlanRepository.findById(planId);
    if (!plan) throw new NotFoundError('encounter plan', planId);

    const access = await authz.campaign(plan.campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('launch encounters', 'campaign');
    }

    // Create the live encounter in the session
    const encounter = await encounterRepository.create({
      sessionId,
      name: plan.name,
    });

    // Add each creature as participants
    for (const creature of plan.creatures) {
      for (let i = 0; i < creature.count; i++) {
        const statBlock = creature.statBlock as Record<string, unknown> | null;
        const hp = (statBlock?.hitPoints as number) ?? 10;
        const suffix = creature.count > 1 ? ` ${i + 1}` : '';

        await encounterRepository.addParticipant({
          encounterId: encounter.id,
          name: `${creature.name}${suffix}`,
          type: 'monster',
          initiative: 0,
          hp,
          maxHp: hp,
          npcId: creature.sourceType === 'npc' ? (creature.sourceId ?? undefined) : undefined,
        });
      }
    }

    return encounterRepository.findById(encounter.id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async recalculateXp(planId: string, existingPlan: { partySize?: number; partyLevel?: number; difficulty?: string; creatures: Array<{ xp?: number; count: number }> }) {
    const creatures = existingPlan.creatures.map((c) => ({
      xp: c.xp ?? 0,
      count: c.count,
    }));

    if (creatures.length === 0 || !existingPlan.partySize || !existingPlan.partyLevel) return;

    const diffResult = calculateDifficulty(creatures, existingPlan.partySize, existingPlan.partyLevel);

    await encounterPlanRepository.update(planId, {
      totalXp: diffResult.rawXp,
      adjustedXp: diffResult.adjustedXp,
    });
  }
}

export const encounterPlanService = new EncounterPlanService();
