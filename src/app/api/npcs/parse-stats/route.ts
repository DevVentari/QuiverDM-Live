import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { description, name } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'No description provided' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are a D&D 5e expert. Extract stat block information from this NPC description.

NPC Name: ${name || 'Unknown'}
Description:
${description}

Extract and return ONLY a JSON object with D&D 5e stats. Use null for any fields not mentioned in the description.

Expected format:
{
  "size": "Medium" | "Small" | "Large" | etc,
  "type": "Humanoid" | "Dragon" | "Undead" | etc,
  "alignment": "Lawful Good" | "Chaotic Evil" | etc,
  "ac": number,
  "acType": "natural armor" | "plate mail" | etc,
  "hp": number,
  "hitDice": "8d8+16",
  "speed": "30 ft.",
  "str": number (1-30),
  "dex": number (1-30),
  "con": number (1-30),
  "int": number (1-30),
  "wis": number (1-30),
  "cha": number (1-30),
  "saves": "Dex +5, Wis +3",
  "skills": "Perception +5, Stealth +7",
  "damageResistances": "fire, cold",
  "damageImmunities": "poison",
  "conditionImmunities": "charmed, frightened",
  "senses": "darkvision 60 ft., passive Perception 15",
  "languages": "Common, Elvish",
  "cr": "5",
  "xp": 1800
}

Return ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the JSON response
    let stats;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        stats = JSON.parse(jsonMatch[0]);
      } else {
        stats = JSON.parse(content.text);
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content.text);
      return NextResponse.json(
        { error: 'Failed to parse AI response', rawResponse: content.text },
        { status: 500 }
      );
    }

    // Clean up null values
    const cleanedStats = Object.fromEntries(
      Object.entries(stats).filter(([_, v]) => v !== null && v !== '')
    );

    return NextResponse.json({ stats: cleanedStats });
  } catch (error) {
    console.error('Error parsing stats:', error);
    return NextResponse.json(
      { error: 'Failed to parse stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
