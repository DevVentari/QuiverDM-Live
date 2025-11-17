/**
 * Test different Gemini prompts to find the best extraction approach
 */

import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Sample markdown from Docling
const sampleMarkdown = `## Test Homebrew Content for D&D

## Magic Items

## Sword of Flames

Weapon (longsword), rare (requires attunement)

This magical longsword is wreathed in flames. You gain a +1 bonus to attack and damage rolls made with this magic weapon. When you hit with an attack using this sword, the target takes an extra 1d6 fire damage.

*Properties:*

- Damage: 1d8 slashing + 1d6 fire
- Bonus: +1 to attack and damage rolls
- Requires Attunement

## Cloak of Shadows

Wondrous item, uncommon

While wearing this cloak, you can use a bonus action to become invisible until the start of your next turn. This property can't be used again until the next dawn.

*Properties:*

- Duration: Until start of next turn
- Uses: Once per day

## Spells

## Arcane Bolt

1st-level evocation

Casting Time: 1 action
Range: 60 feet
Components: V, S
Duration: Instantaneous

You launch a bolt of arcane energy at a creature you can see within range. Make a ranged spell attack. On a hit, the target takes 2d8 force damage.

At Higher Levels: When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.

## Creatures

## Shadow Drake

Small dragon, neutral evil

Armor Class: 14 (natural armor)
Hit Points: 27 (5d6 + 10)
Speed: 30 ft., fly 60 ft.

STR 12 (+1) | DEX 16 (+3) | CON 14 (+2) | INT 10 (+0) | WIS 12 (+1) | CHA 13 (+1)

Skills: Stealth +5, Perception +3
Damage Resistances: cold
Senses: darkvision 60 ft., passive Perception 13
Languages: Draconic
Challenge: 2 (450 XP)

Shadow Blend. The shadow drake has advantage on Stealth checks made in dim light or darkness.

*Actions*

Bite. *Melee Weapon Attack:* +5 to hit, reach 5 ft., one target. *Hit:* 7 (1d8 + 3) piercing damage plus 3 (1d6) cold damage.`;

const prompts = [
  {
    name: 'Prompt 1: Detailed with JSON schema',
    prompt: `You are a D&D 5e content expert. Extract ALL homebrew items from this markdown document.

MARKDOWN CONTENT:
${sampleMarkdown}

For each D&D item you find, output ONLY valid JSON in this exact format:
{
  "items": [
    {
      "type": "spell|item|creature|location|subclass|feat|rule",
      "name": "Item Name",
      "data": {
        "description": "Full description",
        "rarity": "Common|Uncommon|Rare|Very Rare|Legendary",
        "level": 1,
        "school": "Evocation"
      },
      "tags": ["keyword1", "keyword2"]
    }
  ]
}

IMPORTANT:
- Output ONLY the JSON object, no explanations
- Extract ALL items from the document
- Include complete stats and descriptions
- Use proper D&D 5e terminology`
  },
  {
    name: 'Prompt 2: Simple and direct',
    prompt: `Extract all D&D 5e homebrew content from this markdown and return as JSON.

${sampleMarkdown}

Return format:
{"items": [{"type": "item|spell|creature", "name": "...", "data": {...}, "tags": [...]}]}`
  },
  {
    name: 'Prompt 3: Step-by-step instructions',
    prompt: `You are extracting D&D homebrew content. Follow these steps:

1. Read this markdown carefully
2. Identify each homebrew item (weapons, spells, creatures, etc.)
3. Extract all details for each item
4. Return as JSON array

MARKDOWN:
${sampleMarkdown}

Return only JSON in this format:
{"items": [{"type": "item", "name": "Sword of Flames", "data": {"description": "...", "rarity": "rare"}, "tags": ["weapon", "fire"]}]}`
  },
  {
    name: 'Prompt 4: Few-shot example',
    prompt: `Extract D&D homebrew items from markdown as JSON.

Example output format:
{"items": [{"type": "spell", "name": "Fireball", "data": {"level": 3, "school": "Evocation", "description": "A bright streak..."}, "tags": ["fire", "damage"]}]}

Now extract from this document:
${sampleMarkdown}

Output JSON only:`
  },
  {
    name: 'Prompt 5: Explicit item count',
    prompt: `This document contains 4 D&D homebrew items:
- 2 magic items (Sword of Flames, Cloak of Shadows)
- 1 spell (Arcane Bolt)
- 1 creature (Shadow Drake)

Extract all 4 items as JSON:

${sampleMarkdown}

Return: {"items": [...]}`
  }
];

async function testPrompt(promptData: typeof prompts[0]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Testing: ${promptData.name}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const modelName = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptData.prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    console.log(`\n📊 Tokens used: ${tokensUsed}`);
    console.log(`\n📄 Raw response (first 500 chars):`);
    console.log(`─`.repeat(60));
    console.log(rawResponse.substring(0, 500));
    console.log(`─`.repeat(60));

    // Try to extract JSON
    const jsonMatch = rawResponse.match(/\{[\s\S]*"items"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const itemCount = parsed.items?.length || 0;
        console.log(`\n✅ JSON parsed successfully!`);
        console.log(`   Items extracted: ${itemCount}`);

        if (itemCount > 0) {
          console.log(`\n   Items found:`);
          parsed.items.forEach((item: any, i: number) => {
            console.log(`     ${i + 1}. ${item.name} (${item.type})`);
          });
        } else {
          console.log(`   ⚠️  No items in array`);
        }

        // Success rate
        console.log(`\n   Success Rate: ${itemCount}/4 (${Math.round(itemCount / 4 * 100)}%)`);
      } catch (e) {
        console.log(`\n❌ JSON parse error: ${e}`);
      }
    } else {
      console.log(`\n❌ No JSON found in response`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error}`);
  }
}

async function main() {
  console.log('🧪 Testing Gemini Prompts for D&D Extraction\n');
  console.log(`Using Gemini API Key: ${GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}\n`);

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    process.exit(1);
  }

  for (const promptData of prompts) {
    await testPrompt(promptData);
    // Wait 1 second between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 All prompts tested!');
  console.log(`${'='.repeat(60)}`);
}

main().catch(console.error);
