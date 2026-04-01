import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const maxDuration = 60;
import Anthropic from '@anthropic-ai/sdk';
import {
  parseItems,
  stripItemsJson,
  toAnthropicMessages,
  selectModel,
  type ClientMessage,
} from '@/lib/homebrew-chat-helpers';

const SYSTEM_PROMPT = `You are a D&D homebrew content extraction assistant helping a Dungeon Master capture their creative work.

When given images or text containing D&D content:
1. Briefly describe what you see (mention anything unclear or hard to read)
2. Extract all D&D homebrew content you can find
3. Ask 1-2 concise questions about genuinely unclear parts only

When the user corrects or adds information, update your extraction accordingly and confirm the change.

IMPORTANT: Always end every response with a JSON block containing ALL currently extracted items:

\`\`\`json
{"items":[]}
\`\`\`

Item schema: { "name": string, "type": string, "description": string, "properties": {} }
Valid types: item, spell, creature, location, faction, race, rule, adventure, npc_concept, plot_hook, lore, note

Keep descriptions rich — preserve the DM's original detail and voice. Do not summarise or paraphrase.
If nothing D&D-related is found, return the empty items array and say so clearly.`;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const { messages } = (await request.json()) as { messages: ClientMessage[] };
    if (!messages?.length) return NextResponse.json({ error: 'No messages provided' }, { status: 400 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: selectModel(messages),
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: toAnthropicMessages(messages),
    });

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const text = stripItemsJson(rawText);
    const items = parseItems(rawText);

    const updatedMessages: ClientMessage[] = [
      ...messages,
      { role: 'assistant', text: rawText },
    ];

    return NextResponse.json({ text, items, messages: updatedMessages });
  } catch (err) {
    console.error('[homebrew-import/chat] error:', err);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
