/**
 * Ollama Content Extraction System
 *
 * Uses local Ollama LLM to extract structured D&D content from markdown sections
 * Recommended model: qwen2.5:14b (best balance of speed, quality, and context window)
 *
 * Features:
 * - Structured JSON extraction with Zod validation
 * - Batch processing for efficiency
 * - Retry logic for failed extractions
 * - Progress tracking
 * - Error handling and validation
 */

import {
  SpellSchema,
  MagicItemSchema,
  MonsterSchema,
  ClassFeatureSchema,
  FeatSchema,
  RaceSchema,
  BackgroundSchema,
  HomebrewContentSchema,
  BatchExtractionResultSchema,
  type Spell,
  type MagicItem,
  type Monster,
  type ClassFeature,
  type Feat,
  type Race,
  type Background,
  type HomebrewContent,
  type BatchExtractionResult,
} from './dnd-schemas';
import { generateWithOllama } from './ollama';
import type { MarkdownSection } from './markdown-parser';
import { z } from 'zod';

/**
 * Ollama extraction options
 */
export interface OllamaExtractionOptions {
  model?: string; // Default: qwen2.5:14b
  temperature?: number; // Default: 0.1 (low for consistent structured output)
  maxRetries?: number; // Default: 2
  batchSize?: number; // How many sections to process in parallel (default: 3)
  onProgress?: (current: number, total: number, section: string) => void;
}

const DEFAULT_MODEL = 'qwen2.5:14b';
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BATCH_SIZE = 3;

/**
 * Extract D&D content from a markdown section using Ollama
 */
export async function extractContent(
  section: MarkdownSection,
  options: OllamaExtractionOptions = {}
): Promise<HomebrewContent | null> {
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // Get the appropriate schema for this section type
  const schema = getSchemaForType(section.type);
  if (!schema) {
    console.log(`[Ollama] No schema for type: ${section.type}`);
    return null;
  }

  const prompt = buildExtractionPrompt(section, schema);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Ollama] Extracting ${section.type}: "${section.title}" (attempt ${attempt}/${maxRetries})`);

      const response = await generateWithOllama(prompt, {
        model,
        temperature,
        format: 'json', // Request JSON output
      });

      // Parse and validate the JSON response
      const parsed = JSON.parse(response);
      const validated = schema.parse(parsed);

      // Wrap in HomebrewContent structure
      const content: HomebrewContent = {
        type: section.type as any,
        data: validated as any,
      };

      // Validate the complete structure
      HomebrewContentSchema.parse(content);

      console.log(`[Ollama] Successfully extracted: "${section.title}"`);
      return content;

    } catch (error) {
      lastError = error as Error;
      console.warn(`[Ollama] Extraction attempt ${attempt} failed for "${section.title}":`, error);

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(`[Ollama] Failed to extract "${section.title}" after ${maxRetries} attempts:`, lastError);
  return null;
}

/**
 * Extract content from multiple sections in batches
 */
export async function extractBatch(
  sections: MarkdownSection[],
  options: OllamaExtractionOptions = {}
): Promise<BatchExtractionResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;

  const items: HomebrewContent[] = [];
  const errors: Array<{ section: string; error: string }> = [];

  // Process in batches to avoid overwhelming Ollama
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, Math.min(i + batchSize, sections.length));

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(section => extractContent(section, options))
    );

    // Collect results
    results.forEach((result, idx) => {
      const section = batch[idx];

      if (options.onProgress) {
        options.onProgress(i + idx + 1, sections.length, section.title);
      }

      if (result.status === 'fulfilled' && result.value) {
        items.push(result.value);
      } else {
        const error = result.status === 'rejected' ? result.reason : 'Unknown error';
        errors.push({
          section: section.title,
          error: String(error),
        });
      }
    });
  }

  const processingTime = Date.now() - startTime;

  const batchResult: BatchExtractionResult = {
    success: errors.length === 0,
    items,
    errors,
    metadata: {
      totalSections: sections.length,
      successfulExtractions: items.length,
      failedExtractions: errors.length,
      processingTime,
    },
  };

  return BatchExtractionResultSchema.parse(batchResult);
}

/**
 * Get the appropriate Zod schema for a section type
 */
function getSchemaForType(type: MarkdownSection['type']): z.ZodType | null {
  switch (type) {
    case 'spell':
      return SpellSchema;
    case 'item':
      return MagicItemSchema;
    case 'monster':
      return MonsterSchema;
    case 'class_feature':
      return ClassFeatureSchema;
    case 'feat':
      return FeatSchema;
    case 'race':
      return RaceSchema;
    case 'background':
      return BackgroundSchema;
    default:
      return null;
  }
}

/**
 * Build the extraction prompt for Ollama
 */
function buildExtractionPrompt(section: MarkdownSection, schema: z.ZodType): string {
  const schemaDescription = getSchemaDescription(section.type);

  return `You are a D&D 5th Edition content extraction expert. Your task is to extract structured data from D&D content and output it as valid JSON.

IMPORTANT INSTRUCTIONS:
1. Output ONLY valid JSON - no markdown, no explanations, no extra text
2. Follow the exact schema provided below
3. Use null for optional fields if information is not available
4. Extract dice rolls in the format: {"count": N, "sides": N, "modifier": N, "type": "damage_type"}
5. Be precise with numbers, enums, and data types
6. If you cannot extract complete valid data, output an empty object: {}

SCHEMA:
${schemaDescription}

CONTENT TYPE: ${section.type}
TITLE: ${section.title}

CONTENT TO EXTRACT:
${section.content}

OUTPUT (valid JSON only):`;
}

/**
 * Get human-readable schema description for the prompt
 */
function getSchemaDescription(type: MarkdownSection['type']): string {
  switch (type) {
    case 'spell':
      return `{
  "name": "string",
  "level": 0-9 (number, 0 for cantrips),
  "school": "abjuration" | "conjuration" | "divination" | "enchantment" | "evocation" | "illusion" | "necromancy" | "transmutation",
  "castingTime": "string (e.g., '1 action', '1 bonus action')",
  "range": "string (e.g., '60 feet', 'Self', 'Touch')",
  "components": {
    "verbal": boolean,
    "somatic": boolean,
    "material": boolean,
    "materialDescription": "string (optional)"
  },
  "duration": "string (e.g., 'Instantaneous', 'Concentration, up to 1 minute')",
  "isRitual": boolean (optional),
  "requiresConcentration": boolean,
  "description": "string (full spell description)",
  "higherLevels": "string (optional, when cast at higher levels)",
  "damage": [{"count": number, "sides": number, "modifier": number, "type": "string"}] (optional),
  "savingThrow": {"ability": "STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA", "description": "string"} (optional),
  "attackType": "melee" | "ranged" | "none" (optional),
  "classes": ["string"] (optional),
  "source": "string (optional)"
}`;

    case 'item':
      return `{
  "name": "string",
  "type": "weapon" | "armor" | "potion" | "ring" | "rod" | "scroll" | "staff" | "wand" | "wondrous item" | "other",
  "rarity": "common" | "uncommon" | "rare" | "very rare" | "legendary" | "artifact",
  "requiresAttunement": boolean,
  "attunementRequirements": "string (optional)",
  "description": "string",
  "properties": ["string"] (optional),
  "damage": [{"count": number, "sides": number, "modifier": number, "type": "string"}] (optional),
  "armorClass": number (optional),
  "bonuses": {
    "attackBonus": number (optional),
    "damageBonus": number (optional),
    "acBonus": number (optional),
    "savingThrowBonus": number (optional)
  } (optional),
  "charges": {"maximum": number, "recharge": "string"} (optional),
  "weight": number (optional),
  "value": {"amount": number, "currency": "cp"|"sp"|"ep"|"gp"|"pp"} (optional),
  "source": "string (optional)"
}`;

    case 'monster':
      return `{
  "name": "string",
  "size": "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan",
  "type": "string (e.g., 'humanoid (goblinoid)', 'dragon', 'undead')",
  "alignment": "string",
  "armorClass": number,
  "hitPoints": {"average": number, "dice": {"count": number, "sides": number, "modifier": number}},
  "speed": {"walk": number, "fly": number, "swim": number, "climb": number, "burrow": number, "hover": boolean},
  "abilityScores": {"strength": number, "dexterity": number, "constitution": number, "intelligence": number, "wisdom": number, "charisma": number},
  "savingThrows": {"STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA": number} (optional),
  "skills": {"skill_name": number} (optional),
  "damageResistances": ["damage_type"] (optional),
  "damageImmunities": ["damage_type"] (optional),
  "damageVulnerabilities": ["damage_type"] (optional),
  "conditionImmunities": ["condition"] (optional),
  "senses": {"darkvision": number, "blindsight": number, "tremorsense": number, "truesight": number, "passivePerception": number},
  "languages": ["string"] (optional),
  "challengeRating": number (can be fractional: 0.125, 0.25, 0.5, etc.),
  "experiencePoints": number,
  "traits": [{"name": "string", "description": "string"}] (optional),
  "actions": [{"name": "string", "description": "string", "attackBonus": number, "damage": [], "reach": number, "range": "string"}],
  "reactions": [{"name": "string", "description": "string"}] (optional),
  "legendaryActions": {"count": number, "actions": [{"name": "string", "cost": number, "description": "string"}]} (optional),
  "lairActions": [{"description": "string", "initiative": number}] (optional),
  "source": "string (optional)"
}`;

    case 'class_feature':
      return `{
  "name": "string",
  "className": "string",
  "subclass": "string (optional)",
  "level": number (1-20),
  "description": "string",
  "benefits": ["string"] (optional),
  "prerequisites": "string (optional)",
  "uses": {"type": "per_short_rest"|"per_long_rest"|"per_day"|"unlimited"|"charges", "count": number, "recharge": "string"} (optional),
  "source": "string (optional)"
}`;

    case 'feat':
      return `{
  "name": "string",
  "prerequisites": "string (optional)",
  "description": "string",
  "benefits": ["string"],
  "abilityScoreIncrease": {"options": ["STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA"], "amount": number} (optional),
  "source": "string (optional)"
}`;

    case 'race':
      return `{
  "name": "string",
  "subrace": "string (optional)",
  "abilityScoreIncrease": {"STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA": number},
  "age": "string",
  "alignment": "string",
  "size": "small" | "medium" | "large",
  "speed": number,
  "languages": ["string"],
  "traits": [{"name": "string", "description": "string"}],
  "source": "string (optional)"
}`;

    case 'background':
      return `{
  "name": "string",
  "description": "string",
  "skillProficiencies": ["string"],
  "toolProficiencies": ["string"] (optional),
  "languages": ["string"] (optional),
  "equipment": ["string"],
  "feature": {"name": "string", "description": "string"},
  "suggestedCharacteristics": {
    "personalityTraits": ["string"],
    "ideals": ["string"],
    "bonds": ["string"],
    "flaws": ["string"]
  } (optional),
  "source": "string (optional)"
}`;

    default:
      return '{}';
  }
}

/**
 * Test Ollama connectivity and model availability
 */
export async function testOllama(model: string = DEFAULT_MODEL): Promise<{
  available: boolean;
  modelLoaded: boolean;
  error?: string;
}> {
  try {
    console.log(`[Ollama] Testing connection and model: ${model}`);

    const response = await generateWithOllama('Respond with exactly: "OK"', {
      model,
      temperature: 0,
    });

    const available = true;
    const modelLoaded = response.includes('OK');

    if (!modelLoaded) {
      return {
        available,
        modelLoaded: false,
        error: `Model ${model} responded but output was unexpected. You may need to pull the model: ollama pull ${model}`,
      };
    }

    console.log(`[Ollama] Connection successful, model ${model} is ready`);
    return { available: true, modelLoaded: true };

  } catch (error) {
    console.error(`[Ollama] Connection test failed:`, error);
    return {
      available: false,
      modelLoaded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
