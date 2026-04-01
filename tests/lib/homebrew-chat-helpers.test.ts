import { describe, it, expect } from 'vitest';
import { parseItems, stripItemsJson, toAnthropicMessages, selectModel } from '@/lib/homebrew-chat-helpers';

describe('parseItems', () => {
  it('extracts items from a valid json block', () => {
    const text = 'Some text\n```json\n{"items":[{"name":"Sword","type":"item","description":"A blade"}]}\n```';
    const items = parseItems(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Sword');
  });

  it('returns empty array when no json block', () => {
    expect(parseItems('No json here')).toEqual([]);
  });

  it('returns empty array on malformed json', () => {
    expect(parseItems('```json\n{bad json}\n```')).toEqual([]);
  });

  it('returns empty array when items is not an array', () => {
    expect(parseItems('```json\n{"items": "wrong"}\n```')).toEqual([]);
  });
});

describe('stripItemsJson', () => {
  it('removes the items json block from display text', () => {
    const text = 'I found 1 item.\n```json\n{"items":[{"name":"Sword","type":"item","description":"x"}]}\n```';
    expect(stripItemsJson(text)).toBe('I found 1 item.');
  });

  it('leaves text unchanged when no json block present', () => {
    expect(stripItemsJson('Just a message')).toBe('Just a message');
  });
});

describe('selectModel', () => {
  it('returns sonnet when any message has images', () => {
    const messages = [
      { role: 'user' as const, text: 'hi', images: [{ base64: 'abc', mimeType: 'image/jpeg' }] },
    ];
    expect(selectModel(messages)).toBe('claude-sonnet-4-6');
  });

  it('returns haiku for text-only messages', () => {
    const messages = [{ role: 'user' as const, text: 'extract this text' }];
    expect(selectModel(messages)).toBe('claude-haiku-4-5-20251001');
  });
});

describe('toAnthropicMessages', () => {
  it('converts assistant message to string content', () => {
    const result = toAnthropicMessages([{ role: 'assistant', text: 'hello' }]);
    expect(result[0]).toEqual({ role: 'assistant', content: 'hello' });
  });

  it('converts user text-only message to string content', () => {
    const result = toAnthropicMessages([{ role: 'user', text: 'hi' }]);
    expect(result[0]).toEqual({ role: 'user', content: 'hi' });
  });

  it('converts user message with images to content block array', () => {
    const result = toAnthropicMessages([{
      role: 'user',
      text: 'extract',
      images: [{ base64: 'abc123', mimeType: 'image/jpeg' }],
    }]);
    expect(result[0].role).toBe('user');
    const content = result[0].content as any[];
    expect(content[0].type).toBe('image');
    expect(content[0].source.data).toBe('abc123');
    expect(content[1].type).toBe('text');
    expect(content[1].text).toBe('extract');
  });
});
