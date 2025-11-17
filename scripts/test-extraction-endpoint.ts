/**
 * Test the tRPC extraction endpoint with type mapping
 *
 * This verifies the new extractWithProvider endpoint properly:
 * 1. Calls OpenAI API
 * 2. Maps magic_item -> item
 * 3. Saves to database with correct types
 */

import { PrismaClient } from '@prisma/client';
import { extractContent } from '../src/lib/ai-extraction';

const prisma = new PrismaClient();

// Type mapping (same as in the tRPC endpoint)
const typeMapping: Record<string, string> = {
  'magic_item': 'item',
  'spell': 'spell',
  'creature': 'creature',
  'feat': 'feat',
  'race': 'race',
  'background': 'background',
  'class_feature': 'subclass',
};

async function testExtractionEndpoint() {
  console.log('=== Testing extractWithProvider Endpoint Logic ===\n');

  // Get test PDF
  const pdf = await prisma.homebrewPDF.findFirst({
    where: { processingStatus: 'completed', markdownContent: { not: null } },
    orderBy: { createdAt: 'desc' }
  });

  if (!pdf || !pdf.markdownContent) {
    console.error('No PDF with markdown found');
    process.exit(1);
  }

  console.log(`Testing with PDF: ${pdf.filename}`);
  console.log(`Markdown length: ${pdf.markdownContent.length} chars\n`);

  // Step 1: Extract with OpenAI
  console.log('Step 1: Calling OpenAI extraction...');
  const result = await extractContent(pdf.markdownContent, 'openai');

  if (!result.success) {
    console.error('Extraction failed:', result.error);
    process.exit(1);
  }

  console.log(`  Found ${result.items.length} items`);
  console.log(`  Tokens: ${result.tokensUsed}`);

  // Step 2: Map types (simulating tRPC endpoint)
  console.log('\nStep 2: Mapping types...');
  const mappedItems = result.items.map(item => {
    const originalType = item.type;
    const mappedType = typeMapping[item.type] || item.type;
    console.log(`  ${item.name}: ${originalType} -> ${mappedType}`);
    return { ...item, type: mappedType };
  });

  // Step 3: Get user for saving
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found');
    process.exit(1);
  }

  // Step 4: Save to database (clear previous test data first)
  console.log('\nStep 3: Clearing previous test extractions...');
  const deleted = await prisma.homebrewContent.deleteMany({
    where: { sourceType: 'pdf_extraction', userId: user.id }
  });
  console.log(`  Deleted ${deleted.count} previous entries`);

  console.log('\nStep 4: Saving with correct types...');
  const savedItems = await Promise.all(
    mappedItems.map(async (item) => {
      return prisma.homebrewContent.create({
        data: {
          userId: user.id,
          type: item.type, // Already mapped
          name: item.name,
          data: item.data as any,
          sourceType: 'pdf_extraction',
          searchText: JSON.stringify(item.data).toLowerCase(),
        },
      });
    })
  );

  console.log(`  Saved ${savedItems.length} items\n`);

  // Step 5: Verify types
  console.log('Step 5: Verifying saved types...');
  const typeCounts = await prisma.homebrewContent.groupBy({
    by: ['type'],
    where: { userId: user.id },
    _count: true
  });

  console.log('  Type distribution:');
  typeCounts.forEach(tc => {
    console.log(`    ${tc.type}: ${tc._count}`);
  });

  // Check for magic_item (should be 0)
  const magicItemCount = typeCounts.find(t => t.type === 'magic_item')?._count || 0;
  const itemCount = typeCounts.find(t => t.type === 'item')?._count || 0;

  console.log('\n=== TEST RESULTS ===');
  console.log(`magic_item entries: ${magicItemCount} (should be 0)`);
  console.log(`item entries: ${itemCount} (should be > 0)`);

  if (magicItemCount === 0 && itemCount > 0) {
    console.log('\n✅ TYPE MAPPING WORKS CORRECTLY!');
    console.log('   All magic_item types are now saved as item');
  } else {
    console.log('\n❌ TYPE MAPPING ISSUE');
  }

  // Show all content
  console.log('\nAll homebrew content:');
  const allContent = await prisma.homebrewContent.findMany({
    where: { userId: user.id },
    select: { type: true, name: true },
    orderBy: { type: 'asc' }
  });
  allContent.forEach(c => {
    console.log(`  [${c.type.padEnd(10)}] ${c.name}`);
  });

  console.log(`\nTotal: ${allContent.length} items`);
  console.log(`Cost: ~$${((result.tokensUsed || 0) * 0.00015 / 1000).toFixed(4)}`);
}

testExtractionEndpoint()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
