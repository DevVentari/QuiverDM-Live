export interface SelectableEntity {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  lastSeenSessionId: string | null;
}

export interface SelectableRelationship {
  fromEntityId: string;
  toEntityId: string;
  strength: number;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'who', 'what', 'where', 'when', 'why',
  'how', 'about', 'tell', 'with', 'this', 'that', 'them', 'they', 'has', 'have',
  'does', 'did', 'can', 'you', 'me', 'is', 'a', 'an', 'of', 'to', 'in', 'on',
]);

const NAME_WEIGHT = 3;
const ALIAS_WEIGHT = 3;
const DESCRIPTION_WEIGHT = 1;
const NEIGHBOR_DECAY = 0.5;
const RECENCY_BOOST = 0.5;
const DEFAULT_LIMIT = 40;

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function countMatches(haystack: string, tokens: string[]): number {
  const lower = haystack.toLowerCase();
  return tokens.reduce((sum, t) => (lower.includes(t) ? sum + 1 : sum), 0);
}

export function selectRelevantEntities<E extends SelectableEntity>(
  query: string,
  entities: E[],
  relationships: SelectableRelationship[],
  opts?: { limit?: number },
): { selected: E[]; droppedCount: number } {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  if (entities.length === 0) return { selected: [], droppedCount: 0 };

  const tokens = tokenize(query);
  const byId = new Map(entities.map((e) => [e.id, e]));
  const scores = new Map<string, number>();

  for (const e of entities) {
    let score = 0;
    score += NAME_WEIGHT * countMatches(e.name, tokens);
    score += ALIAS_WEIGHT * countMatches(e.aliases.join(' '), tokens);
    if (e.description) score += DESCRIPTION_WEIGHT * countMatches(e.description, tokens);
    if (score > 0) scores.set(e.id, score);
  }

  const seedIds = new Set(scores.keys());
  for (const rel of relationships) {
    const fromSeed = seedIds.has(rel.fromEntityId);
    const toSeed = seedIds.has(rel.toEntityId);
    if (fromSeed === toSeed) continue;
    const seedId = fromSeed ? rel.fromEntityId : rel.toEntityId;
    const neighborId = fromSeed ? rel.toEntityId : rel.fromEntityId;
    if (!byId.has(neighborId)) continue;
    const derived = (scores.get(seedId) ?? 0) * rel.strength * NEIGHBOR_DECAY;
    scores.set(neighborId, (scores.get(neighborId) ?? 0) + derived);
  }

  for (const [id, score] of scores) {
    if (byId.get(id)?.lastSeenSessionId) scores.set(id, score + RECENCY_BOOST);
  }

  let ranked: E[];
  if (scores.size === 0) {
    const strengthById = new Map<string, number>();
    for (const rel of relationships) {
      strengthById.set(rel.fromEntityId, Math.max(strengthById.get(rel.fromEntityId) ?? 0, rel.strength));
      strengthById.set(rel.toEntityId, Math.max(strengthById.get(rel.toEntityId) ?? 0, rel.strength));
    }
    ranked = [...entities].sort((a, b) => {
      const fb = (strengthById.get(b.id) ?? 0) + (b.lastSeenSessionId ? RECENCY_BOOST : 0);
      const fa = (strengthById.get(a.id) ?? 0) + (a.lastSeenSessionId ? RECENCY_BOOST : 0);
      return fb - fa;
    });
  } else {
    ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id)!)
      .filter(Boolean);
  }

  const selected = ranked.slice(0, limit);
  const droppedCount = Math.max(0, ranked.length - selected.length);
  return { selected, droppedCount };
}
