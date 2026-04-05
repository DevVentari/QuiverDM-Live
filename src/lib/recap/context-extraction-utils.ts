export interface TranscriptExtract {
  keyEvents: string[];
  npcsInvolved: string[];
  decisions: string[];
  lootGained: string[];
}

export function parseExtractionResponse(raw: string): TranscriptExtract | null {
  let json = raw.trim();
  const codeBlockMatch = json.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const p = parsed as Record<string, unknown>;

    const toStringArray = (val: unknown): string[] =>
      Array.isArray(val)
        ? val.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : [];

    return {
      keyEvents: toStringArray(p.keyEvents),
      npcsInvolved: toStringArray(p.npcsInvolved),
      decisions: toStringArray(p.decisions),
      lootGained: toStringArray(p.lootGained),
    };
  } catch {
    return null;
  }
}

export function buildContentStrings(extract: TranscriptExtract): string[] {
  const seen = new Set<string>();
  return [
    ...extract.keyEvents,
    ...extract.npcsInvolved,
    ...extract.decisions,
    ...extract.lootGained,
  ]
    .map((s) => s.trim().slice(0, 500))
    .filter((s) => s.length > 0 && !seen.has(s) && seen.add(s) !== undefined);
}
