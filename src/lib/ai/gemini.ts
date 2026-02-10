/**
 * Gemini Content Extraction System
 *
 * Uses Google's Gemini API to extract structured D&D content from markdown
 */

import { z } from 'zod';

export interface ExtractedContent {
  type: 'magic_item' | 'spell' | 'creature' | 'feat' | 'race' | 'background' | 'class_feature';
  name: string;
  data: Record<string, unknown>;
}

export interface ExtractionResult {
  success: boolean;
  items: ExtractedContent[];
  tokensUsed?: number;
  error?: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

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
 * Extract D&D content from markdown using Gemini
 */
export async function extractContentWithGemini(
  markdown: string,
  apiKey?: string
): Promise<ExtractionResult> {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    return {
      success: false,
      items: [],
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    console.log('[Gemini Extraction] Starting content extraction...');
    console.log(`[Gemini Extraction] Markdown length: ${markdown.length} characters`);

    const response = await fetch(`${GEMINI_API_URL}?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: EXTRACTION_PROMPT + markdown,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent structured output
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini Extraction] API error:', errorText);
      return {
        success: false,
        items: [],
        error: `Gemini API error: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();

    // Extract the text response
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      console.error('[Gemini Extraction] No text in response:', result);
      return {
        success: false,
        items: [],
        error: 'No text response from Gemini',
      };
    }

    // Get token usage
    const tokensUsed = result.usageMetadata?.totalTokenCount || 0;
    console.log(`[Gemini Extraction] Tokens used: ${tokensUsed}`);

    // Parse the JSON response
    let items: ExtractedContent[] = [];
    try {
      // Clean up the response - remove any markdown code blocks
      let cleanedResponse = textResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      items = JSON.parse(cleanedResponse);

      if (!Array.isArray(items)) {
        throw new Error('Response is not an array');
      }

      console.log(`[Gemini Extraction] Successfully extracted ${items.length} items`);
      items.forEach((item) => {
        console.log(`  - ${item.type}: ${item.name}`);
      });

    } catch (parseError) {
      console.error('[Gemini Extraction] Failed to parse JSON:', parseError);
      console.error('[Gemini Extraction] Raw response:', textResponse);
      return {
        success: false,
        items: [],
        tokensUsed,
        error: `Failed to parse extraction result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    return {
      success: true,
      items,
      tokensUsed,
    };

  } catch (error) {
    console.error('[Gemini Extraction] Error:', error);
    return {
      success: false,
      items: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save extracted content to database
 */
export async function saveExtractedContent(
  items: ExtractedContent[],
  userId: string,
  pdfId: string,
  campaignId?: string | null,
  prisma?: any
): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;

  if (!prisma) {
    // Import Prisma dynamically to avoid circular dependencies
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  }

  for (const item of items) {
    try {
      // Map extraction types to HomebrewContent types
      const typeMap: Record<string, string> = {
        magic_item: 'item',
        spell: 'spell',
        creature: 'creature',
        feat: 'feat',
        race: 'race',
        background: 'background',
        class_feature: 'subclass', // or 'class'
      };

      const contentType = typeMap[item.type] || item.type;

      // Create the homebrew content
      const content = await prisma.homebrewContent.create({
        data: {
          userId,
          type: contentType,
          name: item.name,
          data: item.data,
          sourceType: 'pdf_extraction',
          tags: [item.type, 'extracted', 'ai-generated'],
          searchText: `${item.name} ${JSON.stringify(item.data)}`.toLowerCase(),
        },
      });

      // Link to campaign if provided
      if (campaignId) {
        await prisma.campaignHomebrewContent.create({
          data: {
            campaignId,
            homebrewId: content.id,
          },
        });
      }

      console.log(`[Gemini Extraction] Saved: ${item.name} (${contentType})`);
      saved++;

    } catch (error) {
      const errorMsg = `Failed to save ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[Gemini Extraction] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  return { saved, errors };
}
