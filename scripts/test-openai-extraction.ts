/**
 * Test OpenAI extraction on Monster_Loot PDF
 *
 * This simulates the full workflow:
 * 1. Get the PDF with markdown content
 * 2. Extract D&D content using OpenAI
 * 3. Save to HomebrewContent database
 * 4. Display the results
 */

import { PrismaClient } from '@prisma/client';
import { extractContent } from '../src/lib/ai-extraction';

const prisma = new PrismaClient();

async function testOpenAIExtraction() {
  console.log('=== OpenAI Extraction Test ===\n');

  // 1. Get the Monster_Loot PDF that has markdown content
  const pdf = await prisma.homebrewPDF.findFirst({
    where: {
      filename: { contains: 'Monster_Loot' },
      processingStatus: 'completed',
      markdownContent: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!pdf || !pdf.markdownContent) {
    console.error('No processed PDF found with markdown content');
    process.exit(1);
  }

  console.log(`Found PDF: ${pdf.filename}`);
  console.log(`Markdown length: ${pdf.markdownContent.length} characters\n`);

  // 2. Extract content using OpenAI
  console.log('Starting OpenAI extraction...\n');
  const result = await extractContent(pdf.markdownContent, 'openai');

  console.log(`\nExtraction Result:`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Provider: ${result.provider}`);
  console.log(`  Items found: ${result.items.length}`);
  console.log(`  Tokens used: ${result.tokensUsed || 'N/A'}`);

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.items.length === 0) {
    console.log('\nNo items extracted. Check the markdown content.');
    process.exit(1);
  }

  // 3. Save to HomebrewContent database (using first user)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database');
    process.exit(1);
  }

  console.log(`\nSaving ${result.items.length} items to database...`);
  const savedItems = await Promise.all(
    result.items.map(async (item) => {
      return prisma.homebrewContent.create({
        data: {
          userId: user.id,
          type: item.type,
          name: item.name,
          data: item.data as any,
          sourceType: 'pdf_extraction',
          searchText: JSON.stringify(item.data).toLowerCase(),
        },
      });
    })
  );

  console.log(`\nSaved ${savedItems.length} items to HomebrewContent:\n`);

  // 4. Display the extracted content nicely
  for (const item of savedItems) {
    console.log(`--- ${item.type.toUpperCase()}: ${item.name} ---`);
    const data = item.data as Record<string, any>;

    // Display based on type
    switch (item.type) {
      case 'magic_item':
        console.log(`  Type: ${data.itemType || data.type}`);
        console.log(`  Rarity: ${data.rarity}`);
        if (data.requiresAttunement) console.log(`  Requires Attunement: Yes`);
        if (data.description) console.log(`  Description: ${data.description.substring(0, 150)}...`);
        break;

      case 'spell':
        console.log(`  Level: ${data.level === 0 ? 'Cantrip' : `${data.level}${getOrdinal(data.level)}-level`}`);
        console.log(`  School: ${data.school}`);
        console.log(`  Casting Time: ${data.castingTime}`);
        console.log(`  Range: ${data.range}`);
        break;

      case 'creature':
        console.log(`  Size: ${data.size}`);
        console.log(`  Type: ${data.type}`);
        console.log(`  CR: ${data.challengeRating}`);
        console.log(`  HP: ${data.hitPoints}`);
        break;

      case 'feat':
        console.log(`  Prerequisite: ${data.prerequisite || 'None'}`);
        if (data.benefits && Array.isArray(data.benefits)) {
          console.log(`  Benefits: ${data.benefits.length} benefit(s)`);
        }
        break;

      default:
        console.log(`  Data: ${JSON.stringify(data).substring(0, 200)}...`);
    }
    console.log('');
  }

  // Show summary
  const typeCounts: Record<string, number> = {};
  for (const item of savedItems) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  }

  console.log('=== SUMMARY ===');
  console.log(`Total items extracted: ${savedItems.length}`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nTokens used: ${result.tokensUsed?.toLocaleString() || 'N/A'}`);
  console.log(`Estimated cost: $${((result.tokensUsed || 0) * 0.00015 / 1000).toFixed(4)}`);

  // Verify in database
  const totalContent = await prisma.homebrewContent.count({
    where: { userId: user.id }
  });
  console.log(`\nTotal items in homebrew library: ${totalContent}`);
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

testOpenAIExtraction()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
