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

Each event should reflect an actor's goals, urgency, and risk tolerance:
- HIGH urgency actors (>0.7): take bold, goal-directed actions that directly advance their primary objectives
- MEDIUM urgency actors (0.4-0.7): take opportunistic actions when the situation allows
- LOW urgency actors (<0.4): remain mostly passive, no action unless prompted

Each event must include a structured effects array describing concrete world-state changes.

Return JSON: { "events": [ { "actorId": "...", "description": "...", "effects": [...] } ] }

Where each effect is one of:
  { "type": "pressure_shift", "track": "political"|"supernatural"|"economic"|"cosmic"|"social", "delta": <number -0.2 to 0.2> }
  { "type": "hook_resolve", "hookId": "<id>", "resolution": "<text>" }
  { "type": "hook_create", "hookDescription": "<text>", "urgency": "low"|"medium"|"high", "linkedEntityIds": ["..."] }
  { "type": "entity_status", "entityId": "<id>", "newStatus": "<text>" }
  { "type": "relationship_change", "fromEntityId": "<id>", "toEntityId": "<id>", "strengthDelta": <number -0.3 to 0.3>, "newDescription": "<text>" }

Each event description should be a vivid 1-2 sentence DM note. Return { "events": [] } if no meaningful events can be generated.`;

export function buildWorldSimulationPrompt(
  actors: WorldActorWithEntity[],
  context: WorldStateContext
): string {
  const sorted = [...actors].sort((a, b) => {
    const urgencyDiff = b.urgency - a.urgency;
    if (Math.abs(urgencyDiff) > 0.01) return urgencyDiff;
    const aRes = typeof a.resources === 'object' && a.resources !== null ? Object.keys(a.resources).length : 0;
    const bRes = typeof b.resources === 'object' && b.resources !== null ? Object.keys(b.resources).length : 0;
    return bRes - aRes;
  });

  const actorSummary = sorted
    .slice(0, 20)
    .map(a => {
      const goals = Array.isArray(a.goals) ? (a.goals as string[]).join(', ') : '';
      const urgencyLabel = a.urgency > 0.7 ? 'HIGH' : a.urgency > 0.4 ? 'MEDIUM' : 'LOW';
      return `- [${urgencyLabel}] ${a.entity.name} (${a.entity.type}, id=${a.id}): urgency=${a.urgency.toFixed(2)}, riskTolerance=${a.riskTolerance.toFixed(2)}, goals=[${goals}]`;
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
    .map(e => `${e.name} (${e.type}, ${e.status}, id=${e.id})`)
    .join(', ');

  return `${SYSTEM_PROMPT}

## Active World Actors
${actorSummary || 'No active actors defined.'}

## Current World Pressure
${pressureSummary}
${highPressureTracks.length > 0 ? `\nNote: ${highPressureTracks.join('; ')}.` : ''}

## World Entities (for context and effect targeting)
${entityContext || 'None tracked.'}

Generate 2-4 plausible world events. HIGH urgency actors must take meaningful goal-directed action. Return as JSON object with "events" array.`;
}
