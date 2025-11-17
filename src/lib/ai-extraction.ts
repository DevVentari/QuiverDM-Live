/**
 * Multi-Provider AI Content Extraction System
 *
 * Supports: Gemini, Anthropic Claude, OpenAI GPT
 * Extracts structured D&D content from markdown
 */

export type ExtractionProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama';

export interface ExtractedContent {
  type: 'magic_item' | 'spell' | 'creature' | 'feat' | 'race' | 'background' | 'class_feature';
  name: string;
  data: Record<string, unknown>;
}

export interface ExtractionResult {
  success: boolean;
  items: ExtractedContent[];
  tokensUsed?: number;
  provider: ExtractionProvider;
  error?: string;
}

const EXTRACTION_PROMPT = `You are a D&D 5e content parser. Extract all homebrew content from the following markdown and return ONLY a JSON array.

For each item found, identify its type and extract relevant data:

1. **magic_item**: weapons, armor, wondrous items, potions, rings, etc.
   - name, type (weapon/armor/potion/ring/wondrous item/etc), rarity, requiresAttunement, description, properties

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
      "properties": ["1d8 slashing", "+1 to attack and damage", "1d6 fire damage"]
    }
  },
  {
    "type": "spell",
    "name": "Arcane Bolt",
    "data": {
      "level": 1,
      "school": "evocation",
      "castingTime": "1 action",
      "range": "60 feet",
      "components": "V, S",
      "duration": "Instantaneous",
      "description": "...",
      "higherLevels": "..."
    }
  }
]

IMPORTANT:
- Return ONLY the JSON array, no markdown code blocks, no explanation
- Extract ALL items found in the text
- Be thorough - don't miss any content
- Use the exact type strings specified above

Markdown to parse:
`;

/**
 * Extract content using Gemini
 */
async function extractWithGemini(markdown: string): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, items: [], provider: 'gemini', error: 'GEMINI_API_KEY not configured' };
  }

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const tokensUsed = result.usageMetadata?.totalTokenCount || 0;

  if (!textResponse) {
    throw new Error('No text in Gemini response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[Gemini] Tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, provider: 'gemini' };
}

/**
 * Extract content using Anthropic Claude
 */
async function extractWithAnthropic(markdown: string): Promise<ExtractionResult> {
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
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + markdown,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.content?.[0]?.text;
  const tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);

  if (!textResponse) {
    throw new Error('No text in Anthropic response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[Anthropic] Tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, provider: 'anthropic' };
}

/**
 * Extract content using OpenAI GPT
 */
async function extractWithOpenAI(markdown: string): Promise<ExtractionResult> {
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
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + markdown,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const textResponse = result.choices?.[0]?.message?.content;
  const tokensUsed = result.usage?.total_tokens || 0;

  if (!textResponse) {
    throw new Error('No text in OpenAI response');
  }

  const items = parseJsonResponse(textResponse);
  console.log(`[OpenAI] Tokens used: ${tokensUsed}`);

  return { success: true, items, tokensUsed, provider: 'openai' };
}

/**
 * Parse JSON response from any provider
 */
function parseJsonResponse(text: string): ExtractedContent[] {
  // Clean up the response - remove markdown code blocks if present
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleanedText);

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not an array');
  }

  return parsed as ExtractedContent[];
}

/**
 * Split markdown into chunks that won't exceed token limits
 * Target ~20K characters per chunk (roughly 5K tokens)
 */
function chunkMarkdown(markdown: string, maxChunkSize: number = 20000): string[] {
  if (markdown.length <= maxChunkSize) {
    return [markdown];
  }

  const chunks: string[] = [];
  const lines = markdown.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    // If adding this line would exceed the limit, save current chunk and start new one
    if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Main extraction function - supports multiple providers
 * Automatically chunks large documents to avoid token limit issues
 */
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini'
): Promise<ExtractionResult> {
  console.log(`[AI Extraction] Starting extraction with ${provider}...`);
  console.log(`[AI Extraction] Markdown length: ${markdown.length} characters`);

  // Chunk large documents to avoid token limit issues
  const chunks = chunkMarkdown(markdown, 25000); // ~6K tokens per chunk
  console.log(`[AI Extraction] Split into ${chunks.length} chunks`);

  const allItems: ExtractedContent[] = [];
  let totalTokens = 0;
  const errors: string[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[AI Extraction] Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

      let result: ExtractionResult;

      switch (provider) {
        case 'anthropic':
          result = await extractWithAnthropic(chunks[i]);
          break;
        case 'openai':
          result = await extractWithOpenAI(chunks[i]);
          break;
        case 'gemini':
        default:
          result = await extractWithGemini(chunks[i]);
          break;
      }

      if (result.success) {
        allItems.push(...result.items);
        totalTokens += result.tokensUsed || 0;
        console.log(`[AI Extraction] Chunk ${i + 1}: Found ${result.items.length} items`);
      } else {
        errors.push(`Chunk ${i + 1}: ${result.error}`);
        console.warn(`[AI Extraction] Chunk ${i + 1} failed: ${result.error}`);
      }
    }

    console.log(`[AI Extraction] Successfully extracted ${allItems.length} total items with ${provider}`);
    allItems.forEach((item) => {
      console.log(`  - ${item.type}: ${item.name}`);
    });

    return {
      success: allItems.length > 0 || errors.length === 0,
      items: allItems,
      tokensUsed: totalTokens,
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
 * Get available providers based on configured API keys
 */
export function getAvailableProviders(): ExtractionProvider[] {
  const providers: ExtractionProvider[] = [];

  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  // Ollama is always available if running locally
  providers.push('ollama');

  return providers;
}
