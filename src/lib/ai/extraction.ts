/**
 * Multi-Provider AI Content Extraction System
 *
 * Supports: Gemini, Anthropic Claude, OpenAI GPT, Ollama (local)
 * Features:
 * - Robust JSON parsing with fallback for malformed LLM responses
 * - Provider fallback chain (tries multiple providers on failure)
 * - Ollama integration for local extraction
 * - Timeout support via AbortSignal
 */

import { isOllamaAvailable } from './ollama';
import { parseMarkdown } from '../markdown-parser';
import { extractBatch } from './ollama-extraction';

export type ExtractionProvider = 'gemini' | 'anthropic' | 'openai' | 'groq' | 'ollama';

export interface ExtractedContent {
  type: 'magic_item' | 'spell' | 'creature' | 'feat' | 'race' | 'background' | 'class_feature';
  name: string;
  data: Record<string, unknown>;
}

export interface ExtractionResult {
  success: boolean;
  items: ExtractedContent[];
  tokensUsed?: number;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  provider: ExtractionProvider;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes per chunk

const EXTRACTION_PROMPT = `You are a D&D 5e content parser. Extract all homebrew content from the following markdown and return ONLY a JSON array.

For each item found, identify its type and extract relevant data:

1. **magic_item**: weapons, armor, wondrous items, potions, rings, crafted items, etc.
   - name, itemType (weapon/armor/potion/ring/wondrous item/etc), rarity, requiresAttunement, description, properties

2. **spell**: magical spells
   - name, level (0 for cantrip), school, castingTime, range, components, duration, description, higherLevels

3. **creature**: monsters, NPCs with stat blocks
   - name, size, type, alignment, armorClass, hitPoints, speed, abilityScores, skills, senses, languages, challengeRating, traits, actions

4. **feat**: character feats
   - name, prerequisite, description, benefits

5. **race**: playable races
   - name, abilityScoreIncrease, age, size, speed, traits, languages

6. **background**: character backgrounds
   - name, skillProficiencies, toolProficiencies, languages, equipment, feature, characteristics

7. **class_feature**: class or subclass features
   - name, className, level, description

8. **harvesting_material**: raw materials harvested from creatures (rows in harvest/loot tables). Use this for any table row with DC, item name, description, value, weight, and optional crafting columns.
   - name, sourceCreature (the monster this is harvested from — look at the section heading above the table), dc (number), quantity (e.g. "1", "3 vials", "small pouch"), description, value (e.g. "8 sp", "20 gp"), weight (e.g. "0.1 lb", "-"), crafting (what it can be crafted into, or null)
   - imagePromptHint: a visual description of the raw material itself (texture, colour, appearance)

For EVERY item, also include an "imagePromptHint" field: a concise 1-2 sentence visual description drawn from the source text, written as an image generation prompt. Focus on physical appearance, colours, materials, and atmosphere. Example: "A gnarled obsidian staff crowned with a swirling void gem, crackling with dark purple lightning." If no visual description exists in the text, generate a fitting one based on the item's name and type.

For magic_items, spells, and feats, extract an "effects" array when the content grants mechanical bonuses. Each effect:
{
  "name": "short effect name",
  "description": "plain English description",
  "mechanic": {
    "type": one of: "ac_bonus" | "attack_bonus" | "damage_bonus" | "ability_bonus" | "saving_throw_bonus" | "skill_bonus" | "resistance" | "immunity" | "vulnerability" | "advantage" | "disadvantage" | "spell_attack_bonus" | "save_dc_bonus" | "initiative_bonus" | "speed_bonus" | "max_hp_bonus" | "concentration_advantage" | "death_save_advantage" | "damage_bypass" | "custom",
    "target": "what it applies to (e.g. dexterity, fire, stealth, constitution saving throw)",
    "value": numeric bonus or dice string like "1d4",
    "condition": "when it applies (e.g. while equipped, while attuned)",
    "activation": "passive" | "concentration" | "action" | "bonus_action" | "reaction",
    "duration": "how long it lasts (e.g. 1 minute, until long rest, permanent)"
  }
}

Examples:
- "Ring of Protection: +1 to AC and saving throws" → effects: [{"name":"AC Bonus","description":"+1 AC","mechanic":{"type":"ac_bonus","value":1,"activation":"passive"}},{"name":"Save Bonus","description":"+1 to saving throws","mechanic":{"type":"saving_throw_bonus","value":1,"activation":"passive"}}]
- "Bless: targets add 1d4 to attack rolls and saving throws" → effects: [{"name":"Attack Bonus","description":"+1d4 to attacks","mechanic":{"type":"attack_bonus","value":"1d4","activation":"concentration","duration":"1 minute"}},{"name":"Save Bonus","description":"+1d4 to saves","mechanic":{"type":"saving_throw_bonus","value":"1d4","activation":"concentration","duration":"1 minute"}}]
- "Alert feat: +5 to initiative, can't be surprised" → effects: [{"name":"Initiative","description":"+5 to initiative","mechanic":{"type":"initiative_bonus","value":5,"activation":"passive"}}]

Only include effects with clear mechanical numbers or dice. Skip flavor-only text.

Return a JSON array like:
[
  {
    "type": "magic_item",
    "name": "Sword of Flames",
    "data": {
      "itemType": "weapon",
      "rarity": "rare",
      "requiresAttunement": true,
      "description": "...",
      "properties": ["1d8 slashing", "+1 to attack and damage", "1d6 fire damage"],
      "imagePromptHint": "A blazing longsword with a hilt wrapped in fire-resistant leather, its blade permanently wreathed in dancing orange and red flames."
    }
  },
  {
    "type": "harvesting_material",
    "name": "Aboleth Mucus",
    "data": {
      "sourceCreature": "Aboleth",
      "dc": 15,
      "quantity": "3 vials",
      "description": "A thick, viscous mucus secreted by the aboleth. Can be used as a contact poison.",
      "value": "20 gp",
      "weight": "0.5 lb",
      "crafting": "Potion of Water Breathing",
      "imagePromptHint": "Three small glass vials filled with a thick, translucent blue-grey slime, faintly luminescent."
    }
  }
]

IMPORTANT:
- Return ONLY the JSON array, no markdown code blocks, no explanation
- Extract ALL items found in the text — for harvest tables, extract EVERY row as a harvesting_material
- Be thorough - don't miss any content
- Use the exact type strings specified above
- Always include imagePromptHint in the data object

Markdown to parse:
`;

// =============================================================================
// Robust JSON Parsing
// =============================================================================

/**
 * Parse JSON response from any LLM provider.
 * Handles common LLM output quirks: code fences, trailing commas,
 * wrapped objects, and partial JSON recovery.
 */
function parseJsonResponse(text: string): ExtractedContent[] {
  let cleaned = text.trim();

  // Step 1: Strip code fences (```json, ```JSON, ```, etc.)
  cleaned = stripCodeFences(cleaned);

  // Step 2: Try direct parse
  const direct = tryParseArray(cleaned);
  if (direct) return direct;

  // Step 3: Fix trailing commas and retry
  const fixedCommas = fixTrailingCommas(cleaned);
  const afterCommaFix = tryParseArray(fixedCommas);
  if (afterCommaFix) return afterCommaFix;

  // Step 4: Try to extract array from wrapped object (e.g. {"items": [...]})
  const unwrapped = tryUnwrapObject(fixedCommas);
  if (unwrapped) return unwrapped;

  // Step 5: Partial recovery — extract individual JSON objects from the text
  const recovered = recoverPartialItems(fixedCommas);
  if (recovered.length > 0) {
    console.warn(`[JSON Parser] Partial recovery: extracted ${recovered.length} items from malformed response`);
    return recovered;
  }

  throw new Error('Failed to parse JSON response: no valid items found');
}

function stripCodeFences(text: string): string {
  // Handle ```json ... ```, ```JSON ... ```, ``` ... ```
  const fenceMatch = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Handle only opening fence (LLM forgot to close)
  if (/^```(?:json|JSON)?\s*\n/.test(text)) {
    return text.replace(/^```(?:json|JSON)?\s*\n/, '').replace(/\n?\s*```$/, '').trim();
  }

  return text;
}

function tryParseArray(text: string): ExtractedContent[] | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function fixTrailingCommas(text: string): string {
  // Remove trailing commas before ] or }
  return text
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}');
}

function tryUnwrapObject(text: string): ExtractedContent[] | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      // Look for any array value in the object
      for (const value of Object.values(parsed)) {
        if (Array.isArray(value) && value.length > 0) {
          return value;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function recoverPartialItems(text: string): ExtractedContent[] {
  const items: ExtractedContent[] = [];
  // Match JSON objects that look like extracted content items
  const objectPattern = /\{[^{}]*"type"\s*:\s*"[^"]+?"[^{}]*"name"\s*:\s*"[^"]+?"[^{}]*\}/g;
  const matches = text.match(objectPattern);

  if (!matches) return items;

  for (const match of matches) {
    try {
      const obj = JSON.parse(fixTrailingCommas(match));
      if (obj.type && obj.name) {
        items.push(obj);
      }
    } catch {
      // Skip unparseable items
    }
  }

  return items;
}

// =============================================================================
// Provider Implementations
// =============================================================================

async function extractWithGemini(markdown: string, signal?: AbortSignal, apiKey?: string): Promise<ExtractionResult> {
  const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY;
  if (!resolvedKey) {
    return { success: false, items: [], provider: 'gemini', error: 'GEMINI_API_KEY not configured' };
  }

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

  const response = await fetch(`${GEMINI_API_URL}?key=${resolvedKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: EXTRACTION_PROMPT + markdown }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const tokensIn = result.usageMetadata?.promptTokenCount || 0;
  const tokensOut = result.usageMetadata?.candidatesTokenCount || 0;
  const tokensUsed = result.usageMetadata?.totalTokenCount || 0;

  if (!textResponse) {
    throw new Error('No text in Gemini response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[Gemini] Extracted ${items.length} items, tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'gemini-2.5-flash-lite', provider: 'gemini' };
}

async function extractWithAnthropic(markdown: string, signal?: AbortSignal): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { success: false, items: [], provider: 'anthropic', error: 'ANTHROPIC_API_KEY not configured' };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + markdown }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.content?.[0]?.text;
  const tokensIn = result.usage?.input_tokens || 0;
  const tokensOut = result.usage?.output_tokens || 0;
  const tokensUsed = tokensIn + tokensOut;

  if (!textResponse) {
    throw new Error('No text in Anthropic response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[Anthropic] Extracted ${items.length} items, tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'claude-sonnet-4-20250514', provider: 'anthropic' };
}

async function extractWithGroq(markdown: string, signal?: AbortSignal): Promise<ExtractionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, items: [], provider: 'groq', error: 'GROQ_API_KEY not configured' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 8192,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + markdown }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.choices?.[0]?.message?.content;
  const tokensIn = result.usage?.prompt_tokens || 0;
  const tokensOut = result.usage?.completion_tokens || 0;
  const tokensUsed = result.usage?.total_tokens || 0;

  if (!textResponse) throw new Error('No text in Groq response');

  const items = parseJsonResponse(textResponse);
  console.log(`[Groq] Extracted ${items.length} items, tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'llama-3.3-70b-versatile', provider: 'groq' };
}

async function extractWithOpenAI(markdown: string, signal?: AbortSignal): Promise<ExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, items: [], provider: 'openai', error: 'OPENAI_API_KEY not configured' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 8192,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + markdown }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.choices?.[0]?.message?.content;
  const tokensIn = result.usage?.prompt_tokens || 0;
  const tokensOut = result.usage?.completion_tokens || 0;
  const tokensUsed = result.usage?.total_tokens || 0;

  if (!textResponse) {
    throw new Error('No text in OpenAI response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[OpenAI] Extracted ${items.length} items, tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'gpt-4o-mini', provider: 'openai' };
}

/**
 * Extract content using local Ollama.
 * Uses the section-based extraction from ollama-extraction.ts
 * and converts results back to ExtractedContent format.
 */
async function extractWithOllamaProvider(markdown: string): Promise<ExtractionResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return { success: false, items: [], provider: 'ollama', error: 'Ollama is not running' };
  }

  const parsed = parseMarkdown(markdown);
  const sections = parsed.sections.filter((s) => s.type !== 'unknown');

  if (sections.length === 0) {
    // No recognized D&D sections — Ollama can't help here, signal failure
    // so the fallback chain can try cloud providers with the raw prompt approach
    return { success: false, items: [], provider: 'ollama', error: 'No recognized D&D sections found in markdown' };
  }

  // Probe: run 1 section with 1 retry — fast check to see if Ollama can extract
  // valid items from this document. Chapter headings / unusual formats fail fast.
  const probeResult = await extractBatch(sections.slice(0, 1), { batchSize: 1, maxRetries: 1 });
  if (probeResult.items.length === 0) {
    return {
      success: false,
      items: [],
      provider: 'ollama',
      error: 'Probe batch produced no valid items — document structure not compatible with section-based extraction',
    };
  }

  // Probe succeeded — process remaining sections
  const remaining = sections.slice(1);
  const batchResult = remaining.length > 0
    ? await extractBatch(remaining, { batchSize: 3 })
    : { items: [], errors: [], metadata: { totalSections: 0, successfulExtractions: 0, failedExtractions: 0, processingTime: 0 } };

  // Merge probe + main results
  const mergedItems = [...probeResult.items, ...batchResult.items];
  const mergedErrors = [...probeResult.errors, ...batchResult.errors];
  const fullBatchResult = { items: mergedItems, errors: mergedErrors };

  // Convert HomebrewContent items to ExtractedContent format
  const items: ExtractedContent[] = fullBatchResult.items.map((item) => ({
    type: item.type as ExtractedContent['type'],
    name: (item.data as any).name || 'Unnamed',
    data: item.data as Record<string, unknown>,
  }));

  console.log(`[Ollama] Extracted ${items.length} items from ${sections.length} sections`);

  return {
    success: items.length > 0 || fullBatchResult.errors.length === 0,
    items,
    provider: 'ollama',
    error: fullBatchResult.errors.length > 0
      ? fullBatchResult.errors.map((e) => `${e.section}: ${e.error}`).join('; ')
      : undefined,
  };
}

// =============================================================================
// Chunking
// =============================================================================

/**
 * Split markdown at paragraph boundaries (last resort for oversized sections).
 */
function splitAtParagraphs(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  for (const para of paragraphs) {
    if (current.length > 0 && current.length + para.length + 2 > maxSize) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Semantic chunking: split at heading boundaries so that stat blocks, spell
 * entries, and other D&D content items are never split across chunks.
 *
 * Strategy:
 * - Split the document into "sections" at # / ## / ### headings
 * - Group consecutive sections into chunks that fit within maxChunkSize
 * - If a single section exceeds maxChunkSize (rare), fall back to paragraph split
 *
 * This preserves tables and multi-paragraph content under each heading intact.
 */
function chunkMarkdown(markdown: string, maxChunkSize: number = 25000): string[] {
  if (markdown.length <= maxChunkSize) return [markdown];

  const headingRegex = /^#{1,3} /;
  const lines = markdown.split('\n');

  // Build sections: each section is one heading + its body
  interface Section { heading: string; body: string[] }
  const sections: Section[] = [];
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    if (headingRegex.test(line)) {
      // Save current section (even if empty body — heading-only sections exist)
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody });
      }
      currentHeading = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  // Last section
  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody });
  }

  // Group sections into chunks
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    const sectionText = section.heading
      ? `${section.heading}\n${section.body.join('\n')}`
      : section.body.join('\n');

    if (currentChunk.length > 0 && currentChunk.length + sectionText.length + 2 > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = sectionText;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + sectionText;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // Safety: if any chunk is still oversized (no headings in a big block), split at paragraphs
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxChunkSize) {
      finalChunks.push(...splitAtParagraphs(chunk, maxChunkSize));
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks.filter((c) => c.length > 0);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Extract content with a specific provider (no fallback).
 * Automatically chunks large documents.
 */
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini',
  userKeys?: { geminiApiKey?: string },
  userId?: string
): Promise<ExtractionResult> {
  console.log(`[AI Extraction] Starting extraction with ${provider}...`);
  console.log(`[AI Extraction] Markdown length: ${markdown.length} characters`);

  // Ollama uses section-based extraction, doesn't need chunking
  if (provider === 'ollama') {
    return extractWithOllamaProvider(markdown);
  }

  const chunks = chunkMarkdown(markdown, 25000);
  console.log(`[AI Extraction] Split into ${chunks.length} semantic chunk(s)`);

  const allItems: ExtractedContent[] = [];
  let totalTokens = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const errors: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[AI Extraction] Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

      const signal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      let result: ExtractionResult;

      switch (provider) {
        case 'anthropic':
          result = await extractWithAnthropic(chunks[i], signal);
          break;
        case 'openai':
          result = await extractWithOpenAI(chunks[i], signal);
          break;
        case 'groq':
          result = await extractWithGroq(chunks[i], signal);
          break;
        case 'gemini':
        default:
          result = await extractWithGemini(chunks[i], signal, userKeys?.geminiApiKey);
          break;
      }

      if (result.success) {
        allItems.push(...result.items);
        totalTokens += result.tokensUsed || 0;
        totalTokensIn += result.tokensIn || 0;
        totalTokensOut += result.tokensOut || 0;
        console.log(`[AI Extraction] Chunk ${i + 1}: Found ${result.items.length} items`);
      } else {
        errors.push(`Chunk ${i + 1}: ${result.error}`);
        console.warn(`[AI Extraction] Chunk ${i + 1} failed: ${result.error}`);
      }
    }

    console.log(`[AI Extraction] Extracted ${allItems.length} total items with ${provider}`);

    if (userId && totalTokens > 0) {
      const { logApiUsage } = await import('./usage-logger');
      const modelName = provider === 'gemini' ? 'gemini-2.5-flash-lite' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini';
      void logApiUsage({
        userId,
        provider,
        model: modelName,
        feature: 'extraction',
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
      });
    }

    return {
      success: allItems.length > 0 || errors.length === 0,
      items: allItems,
      tokensUsed: totalTokens,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      provider,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    console.error(`[AI Extraction] Error with ${provider}:`, error);
    return {
      success: false,
      items: allItems,
      tokensUsed: totalTokens,
      provider,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract content with automatic provider fallback.
 *
 * Strategy:
 * - If Ollama is available AND markdown has <20 sections: try Ollama first → cloud fallback
 * - Otherwise: try configured cloud provider → other cloud providers → Ollama last
 */
export async function extractWithFallback(
  markdown: string,
  preferredProvider?: ExtractionProvider,
  userKeys?: { geminiApiKey?: string },
  userId?: string
): Promise<ExtractionResult> {
  const available = getAvailableProviders();
  if (userKeys?.geminiApiKey && !available.includes('gemini')) {
    available.unshift('gemini');
  }
  console.log(`[AI Extraction] Available providers: ${available.join(', ')}`);

  // Build fallback chain
  let chain: ExtractionProvider[];

  if (preferredProvider) {
    // Put preferred first, then remaining available providers
    chain = [preferredProvider, ...available.filter((p) => p !== preferredProvider)];
  } else {
    // Auto-select: Ollama first (free, local, no rate limits) → cloud fallback
    const ollamaAvailable = available.includes('ollama') && await isOllamaAvailable();

    if (ollamaAvailable) {
      chain = ['ollama', ...available.filter((p) => p !== 'ollama')];
    } else {
      chain = available.filter((p) => p !== 'ollama');
    }
  }

  if (chain.length === 0) {
    return {
      success: false,
      items: [],
      provider: 'gemini',
      error: 'No AI providers available. Configure at least one API key or start Ollama.',
    };
  }

  console.log(`[AI Extraction] Fallback chain: ${chain.join(' → ')}`);

  let bestPartial: ExtractionResult | null = null;

  for (const provider of chain) {
    try {
      console.log(`[AI Extraction] Trying provider: ${provider}`);
      const result = await extractContent(markdown, provider, userKeys, userId);

      if (result.success) {
        return result;
      }

      // Provider returned partial results (e.g. timed out mid-chunk) — keep best so far
      if (result.items.length > 0 && (!bestPartial || result.items.length > bestPartial.items.length)) {
        bestPartial = result;
        console.warn(`[AI Extraction] ${provider} failed mid-way but extracted ${result.items.length} items — keeping as partial`);
      } else {
        console.warn(`[AI Extraction] ${provider} failed: ${result.error}`);
      }
    } catch (error) {
      console.warn(
        `[AI Extraction] ${provider} threw error:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (bestPartial && bestPartial.items.length > 0) {
    console.warn(`[AI Extraction] All providers exhausted — returning best partial result (${bestPartial.items.length} items)`);
    return { ...bestPartial, success: true, error: `Partial extraction: ${bestPartial.error}` };
  }

  return {
    success: false,
    items: [],
    provider: chain[0],
    error: `All providers failed: ${chain.join(', ')}`,
  };
}

/**
 * Get available providers based on configured API keys
 */
export function getAvailableProviders(): ExtractionProvider[] {
  const providers: ExtractionProvider[] = [];

  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.GROQ_API_KEY) providers.push('groq');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  // Ollama is always listed — availability is checked at runtime
  providers.push('ollama');

  return providers;
}
