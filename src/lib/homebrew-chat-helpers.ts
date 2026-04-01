import type Anthropic from '@anthropic-ai/sdk';

export interface ClientMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: Array<{ base64: string; mimeType: string }>;
}

export interface ExtractedItem {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

export function parseItems(text: string): ExtractedItem[] {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function stripItemsJson(text: string): string {
  return text.replace(/```json\s*\{"items"[\s\S]*?```/g, '').trim();
}

export function toAnthropicMessages(messages: ClientMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role === 'assistant') {
      return { role: 'assistant' as const, content: m.text };
    }
    if (m.images && m.images.length > 0) {
      const content: Anthropic.ContentBlockParam[] = [
        ...m.images.map((img) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: img.base64,
          },
        })),
        { type: 'text' as const, text: m.text },
      ];
      return { role: 'user' as const, content };
    }
    return { role: 'user' as const, content: m.text };
  });
}

export function selectModel(messages: ClientMessage[]): string {
  const hasImages = messages.some((m) => m.images && m.images.length > 0);
  return hasImages ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
}
