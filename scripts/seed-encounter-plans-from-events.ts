/**
 * Backfill EncounterPlans for a campaign from its EVENT/encounter entities,
 * linking monster names to stat blocks (book creatures → SRD → custom).
 * Dry-run by default.
 *   npx tsx scripts/seed-encounter-plans-from-events.ts --campaign curse-of-strahd-1
 *   npx tsx scripts/seed-encounter-plans-from-events.ts --campaign curse-of-strahd-1 --write
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { seedEncounterPlansFromWorldEvents } from '../src/lib/encounters/seed-encounter-plans';

async function main() {
  const a = process.argv.slice(2);
  const slug = a[a.indexOf('--campaign') + 1];
  const write = a.includes('--write');
  if (!slug || slug.startsWith('--')) throw new Error('Usage: --campaign <slug> [--write]');

  const campaign = await prisma.campaign.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!campaign) throw new Error(`campaign '${slug}' not found`);

  const r = await seedEncounterPlansFromWorldEvents(campaign.id, { write });
  console.log(`${campaign.name} (${slug}) — ${write ? 'WROTE' : 'dry-run'}`);
  console.log(`  plans: +${r.plansCreated} created, ${r.plansSkipped} skipped (already present)`);
  console.log(`  creatures linked: ${r.creaturesLinked} (srd=${r.bySource.srd}, homebrew=${r.bySource.homebrew}, custom=${r.bySource.custom})`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
