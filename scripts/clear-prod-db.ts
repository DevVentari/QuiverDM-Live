/**
 * Clear prod DB — keeps auth tables only.
 * Run: DATABASE_URL=<prod> npx tsx scripts/clear-prod-db.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing prod DB (keeping auth tables)...');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Campaign",
      "Character",
      "HomebrewContent",
      "HomebrewPDF",
      "NPC",
      "Player",
      "WorldEntity",
      "WorldState",
      "WorldActor",
      "Embedding",
      "Feedback",
      "ApiUsageLog",
      "UserUsage",
      "ImageGenerationJob",
      "EncounterPlan",
      "Encounter",
      "QaFailure",
      "ObsidianImportJob",
      "FoundryImportJob"
    CASCADE
  `);

  console.log('Done. Auth tables (User, Account, Session, UserSettings, etc.) untouched.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
