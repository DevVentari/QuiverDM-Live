import { z } from 'zod';
import { chatWithAI } from './chat';

export const SIExtractedDocSchema = z.object({
  intentBrief: z.string().optional(),
  secrets: z.array(z.object({
    name: z.string(),
    content: z.string(),
    isCritical: z.boolean().default(false),
    knowledge: z.array(z.object({
      entityName: z.string(),
      revealCondition: z.string().optional(),
    })).default([]),
  })).default([]),
  phases: z.array(z.object({
    name: z.string(),
    targetMinutes: z.number().int().default(30),
    notes: z.string().optional(),
  })).default([]),
  routes: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    isActive: z.boolean().default(false),
  })).default([]),
  npcProfiles: z.array(z.object({
    name: z.string(),
    defaultBehavior: z.string(),
    triggeredBehaviors: z.array(z.object({
      condition: z.string(),
      behavior: z.string(),
    })).default([]),
    criticalDialogue: z.array(z.object({
      line: z.string(),
      trigger: z.string(),
    })).default([]),
  })).default([]),
});

export type SIExtractedDoc = z.infer<typeof SIExtractedDocSchema>;

const SYSTEM_PROMPT = `You are a D&D session intelligence extractor. Given a DM's raw prep notes, extract structured data for the Session Intelligence system.

Extract:
- intentBrief: one paragraph summarizing the DM's intent for the session
- secrets: plot secrets, hidden information, and clues. For each secret, list which NPCs (entityName) know it and under what condition they'd reveal it (revealCondition). Mark isCritical:true if revealing this secret is pivotal to the session.
- phases: the rough narrative phases or acts of the session. Each has a name and estimated minutes (targetMinutes, default 30 if unclear).
- routes: the different paths or choices players might take. Mark the most likely route as isActive:true.
- npcProfiles: behavioral profiles for each NPC. defaultBehavior is how they act by default. triggeredBehaviors are conditional responses (condition → behavior). criticalDialogue are key lines the DM should remember to use.

Return ONLY valid JSON matching the schema. Omit sections where no relevant content exists. If unsure, lean toward extracting more rather than less.`;

function buildUserPrompt(text: string): string {
  return `DM Prep Notes:\n\n${text}\n\nExtract Session Intelligence data as JSON:
{
  "intentBrief": "string",
  "secrets": [{ "name": "string", "content": "string", "isCritical": false, "knowledge": [{ "entityName": "string", "revealCondition": "string" }] }],
  "phases": [{ "name": "string", "targetMinutes": 30, "notes": "string" }],
  "routes": [{ "name": "string", "description": "string", "isActive": false }],
  "npcProfiles": [{ "name": "string", "defaultBehavior": "string", "triggeredBehaviors": [{ "condition": "string", "behavior": "string" }], "criticalDialogue": [{ "line": "string", "trigger": "string" }] }]
}`;
}

export async function extractSIDoc(text: string): Promise<SIExtractedDoc> {
  const raw = await chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text) },
    ],
    { forceProvider: 'claude', temperature: 0.2 }
  );

  try {
    const parsed = JSON.parse(raw);
    return SIExtractedDocSchema.parse(parsed);
  } catch {
    return SIExtractedDocSchema.parse({});
  }
}
