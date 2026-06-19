// src/server/services/session0-seeder.helpers.ts
interface NamedEntity { id: string; name: string; }
interface Reading { draws: Array<{ slot: string; label: string; card: string; location: string }>; }
export interface SeededNote { type: 'secret'; title: string; body: string; }
export interface SeededSecret { name: string; content: string; }

/** Map blueprint entity names → campaign WorldEntity ids (case-insensitive, de-duped, order-stable). */
export function resolveLinkedEntityIds(names: string[] | undefined, entities: NamedEntity[]): string[] {
  if (!names?.length) return [];
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e.id]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const id = byName.get(n.trim().toLowerCase());
    if (id && !seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

/** One DM secret note per Tarokka draw. */
export function tarokkaToNotes(reading: Reading): SeededNote[] {
  return reading.draws.map((d) => ({
    type: 'secret' as const,
    title: d.label,
    body: `${d.label} — ${d.location}. (Drawn: ${d.card})`,
  }));
}

/** One PrepSecret per Tarokka draw. */
export function tarokkaToSecrets(reading: Reading): SeededSecret[] {
  return reading.draws.map((d) => ({ name: d.label, content: d.location }));
}
