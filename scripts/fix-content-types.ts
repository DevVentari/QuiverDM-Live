import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixContentTypes() {
  console.log('Fixing content types...\n');

  // Fix magic_item -> item
  const result = await prisma.homebrewContent.updateMany({
    where: { type: 'magic_item' },
    data: { type: 'item' }
  });
  console.log(`Updated ${result.count} magic_item entries to item`);

  // Check counts
  const counts = await prisma.homebrewContent.groupBy({
    by: ['type'],
    _count: true
  });

  console.log('\nCurrent type counts:');
  counts.forEach((c) => {
    console.log(`  ${c.type}: ${c._count}`);
  });

  // List all content
  const allContent = await prisma.homebrewContent.findMany({
    select: { id: true, type: true, name: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\nAll homebrew content:');
  allContent.forEach((item) => {
    console.log(`  [${item.type.padEnd(10)}] ${item.name}`);
  });

  console.log(`\nTotal: ${allContent.length} items`);
}

fixContentTypes()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
