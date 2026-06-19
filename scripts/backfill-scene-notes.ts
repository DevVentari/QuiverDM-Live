import 'dotenv/config';
import { prisma } from '@/lib/prisma';

type Check = { skill: string; dc: number; note: string };
type Beat = { wantsInScene: string; secret: string | null };

async function main() {
  const scenes = await prisma.scene.findMany({
    where: { generatedAt: { not: null }, notes: { none: {} } },
    select: { id: true, description: true, dmNotes: true, suggestedChecks: true, entityBeats: true },
  });
  console.log(`[backfill] ${scenes.length} generated scenes without notes`);

  for (const s of scenes) {
    const rows: { type: string; body: string; data?: unknown; orderIndex: number; source: string }[] = [];
    let i = 0;
    if (s.description?.trim()) rows.push({ type: 'read_aloud', body: s.description.trim(), orderIndex: i++, source: 'ai' });
    if (s.dmNotes?.trim()) rows.push({ type: 'lore', body: s.dmNotes.trim(), orderIndex: i++, source: 'ai' });
    for (const c of (s.suggestedChecks as Check[] | null) ?? []) {
      rows.push({ type: 'check', body: c.note, data: { skill: c.skill, dc: c.dc }, orderIndex: i++, source: 'ai' });
    }
    const beats = (s.entityBeats as Record<string, Beat> | null) ?? {};
    for (const [, b] of Object.entries(beats)) {
      if (b.wantsInScene) rows.push({ type: 'tactic', body: b.wantsInScene, orderIndex: i++, source: 'ai' });
      if (b.secret) rows.push({ type: 'secret', body: b.secret, orderIndex: i++, source: 'ai' });
    }
    if (rows.length === 0) continue;
    await prisma.sceneNote.createMany({ data: rows.map((r) => ({ ...r, sceneId: s.id, data: (r.data ?? undefined) as never })) });
    console.log(`[backfill] scene ${s.id}: +${rows.length} notes`);
  }
  console.log('[backfill] done');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
