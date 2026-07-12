import { describe, it, expect } from 'vitest';
import { buildTitlerMessages, parseTitlerResponse } from '@/lib/recap/session-titler';

describe('session titler', () => {
  it('builds a system+user message pair from an excerpt', () => {
    const msgs = buildTitlerMessages('The DM: The gate of Gravenhold looms.');
    expect(msgs[0].role).toBe('system');
    expect(msgs.some((m) => m.content.includes('Gravenhold'))).toBe(true);
  });

  it('parses a JSON title response', () => {
    const out = parseTitlerResponse('{"title":"The Gate of Gravenhold","voice":"war-weary arrival at a hard city","chapter":8}');
    expect(out).toEqual({ title: 'The Gate of Gravenhold', voice: 'war-weary arrival at a hard city', chapter: 8 });
  });

  it('tolerates prose-wrapped JSON and a missing chapter', () => {
    const out = parseTitlerResponse('Here you go:\n{"title":"Ashes","voice":"grim"}\nhope that helps');
    expect(out.title).toBe('Ashes');
    expect(out.chapter).toBeNull();
  });
});
