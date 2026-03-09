import type { WorldEntity, WorldState } from '@prisma/client';

interface WorldActorWithEntity {
  id: string;
  entityId: string;
  goals: unknown;
  urgency: number;
  resources: unknown;
  riskTolerance: number;
  entity: WorldEntity;
}

interface WorldStateContext {
  worldState: WorldState;
  entities: WorldEntity[];
}

const SYSTEM_PROMPT = `You are a world simulation engine for a D&D campaign. Given a set of active world actors (factions, NPCs, threats) and the current world pressure state, generate 2-4 plausible causal events that represent what these actors have been doing between sessions.

Each event should reflect an actor's goals, urgency, and risk tolerance. Events should feel consequential but not campaign-breaking. Think of this as the world breathing and moving while the players weren't watching.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "actorId": "optional — the world actor id that drove this event",
    "type": "faction_move" | "npc_action" | "political_shift" | "resource_change" | "rumor_spread" | "threshold_trigger",
    "description": "A vivid 1-2 sentence description of what happened, written as a DM note",
    "causalChain": ["optional array of cause->effect strings explaining the logic"]
  }
]

Return an empty array [] if no meaningful events can be generated.`;

export function buildWorldSimulationPrompt(
  actors: WorldActorWithEntity[],
  context: WorldStateContext
): string {
  const actorSummary = actors
    .slice(0, 20)
    .map(a => {
      const goals = Array.isArray(a.goals) ? (a.goals as string[]).join(', ') : '';
      return `- ${a.entity.name} (${a.entity.type}): urgency=${a.urgency.toFixed(2)}, riskTolerance=${a.riskTolerance.toFixed(2)}, goals=[${goals}]`;
    })
    .join('\n');

  const ws = context.worldState;
  const pressureSummary = [
    `Political: ${ws.pressurePolitical.toFixed(2)}`,
    `Supernatural: ${ws.pressureSupernatural.toFixed(2)}`,
    `Economic: ${ws.pressureEconomic.toFixed(2)}`,
    `Cosmic: ${ws.pressureCosmic.toFixed(2)}`,
    `Social: ${ws.pressureSocial.toFixed(2)}`,
  ].join(' | ');

  const highPressureTracks = [
    ws.pressurePolitical > 0.7 ? 'political tension is high' : null,
    ws.pressureSupernatural > 0.7 ? 'supernatural forces are surging' : null,
    ws.pressureEconomic > 0.7 ? 'economic strain is severe' : null,
    ws.pressureCosmic > 0.7 ? 'cosmic forces are aligning' : null,
    ws.pressureSocial > 0.7 ? 'social unrest is growing' : null,
  ].filter(Boolean);

  const entityContext = context.entities
    .slice(0, 15)
    .map(e => `${e.name} (${e.type}, ${e.status})`)
    .join(', ');

  return `${SYSTEM_PROMPT}

## Active World Actors
${actorSummary || 'No active actors defined.'}

## Current World Pressure
${pressureSummary}
${highPressureTracks.length > 0 ? `\nNote: ${highPressureTracks.join('; ')}.` : ''}

## World Entities (for context)
${entityContext || 'None tracked.'}

Generate 2-4 plausible world events for the next session seed. Return as JSON array.`;
}
