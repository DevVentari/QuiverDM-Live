import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50); // Limit length
}

async function addCampaignSlugs() {
  console.log('Fetching existing campaigns...');

  // Fetch all campaigns using raw SQL since the TypeScript types don't have slug yet
  const campaigns = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM "Campaign"
  `;

  console.log(`Found ${campaigns.length} campaigns without slugs.`);

  if (campaigns.length === 0) {
    console.log('No campaigns to update.');
    return;
  }

  // Track used slugs to handle duplicates
  const usedSlugs = new Set<string>();

  for (const campaign of campaigns) {
    let slug = generateSlug(campaign.name);
    let counter = 1;

    // If slug already used, append a number
    while (usedSlugs.has(slug)) {
      slug = `${generateSlug(campaign.name)}-${counter}`;
      counter++;
    }

    usedSlugs.add(slug);

    console.log(`  ${campaign.name} -> ${slug}`);

    // Update campaign with slug using raw SQL
    await prisma.$executeRaw`
      UPDATE "Campaign"
      SET "slug" = ${slug}
      WHERE "id" = ${campaign.id}
    `;
  }

  console.log('\n✅ Successfully added slugs to all campaigns!');
}

addCampaignSlugs()
  .catch((error) => {
    console.error('❌ Error adding campaign slugs:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
