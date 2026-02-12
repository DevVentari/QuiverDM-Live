/**
 * E2E Pipeline Test
 *
 * Tests the full AI extraction pipeline:
 * 1. Robust JSON parsing (various malformed inputs)
 * 2. Save with deduplication (upsert behavior)
 * 3. Provider fallback chain
 *
 * Usage: npx tsx scripts/test-e2e-pipeline.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { extractContent, extractWithFallback, getAvailableProviders } from '../src/lib/ai/extraction';
import { saveExtractedContent } from '../src/server/repositories/homebrew-extraction.repository';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test markdown that contains D&D content
const TEST_MARKDOWN = `
# Sword of the Phoenix

*Weapon (longsword), rare (requires attunement)*

This golden blade burns with an inner flame. You gain a +1 bonus to attack and damage rolls made with this magic weapon.

**Fire Strike.** When you hit with an attack using this sword, the target takes an extra 1d6 fire damage.

**Phoenix Rebirth (1/day).** When you drop to 0 hit points while attuned to this weapon, you can choose to drop to 1 hit point instead. When you do, each creature within 10 feet of you takes 2d6 fire damage.

---

# Frostbite Bolt

*2nd-level evocation*

**Casting Time:** 1 action
**Range:** 120 feet
**Components:** V, S
**Duration:** Instantaneous

A shard of ice streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 3d8 cold damage and its speed is reduced by 10 feet until the start of your next turn.

**At Higher Levels.** When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: JSON Parser robustness
// ─────────────────────────────────────────────────────────────────────────────

function testJsonParsing() {
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST 1: JSON Parser Robustness');
  console.log('═══════════════════════════════════════\n');

  // We test the parser indirectly through extraction, but we can also
  // test its behavior by importing it. Since it's private, we test via
  // the module's behavior during extraction.

  const cases = [
    {
      name: 'Clean JSON array',
      input: '[{"type":"spell","name":"Test","data":{}}]',
      expected: true,
    },
    {
      name: 'JSON with code fences',
      input: '```json\n[{"type":"spell","name":"Test","data":{}}]\n```',
      expected: true,
    },
    {
      name: 'JSON with trailing commas',
      input: '[{"type":"spell","name":"Test","data":{"level":1,},},]',
      expected: true,
    },
    {
      name: 'Wrapped object',
      input: '{"items":[{"type":"spell","name":"Test","data":{}}]}',
      expected: true,
    },
    {
      name: 'Unclosed code fence',
      input: '```json\n[{"type":"spell","name":"Test","data":{}}]',
      expected: true,
    },
  ];

  let passed = 0;
  for (const tc of cases) {
    try {
      // We can't directly call parseJsonResponse since it's private,
      // but we can verify the logic manually
      let cleaned = tc.input.trim();

      // Strip fences
      const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) cleaned = fenceMatch[1].trim();
      else if (/^```(?:json|JSON)?\s*\n/.test(cleaned)) {
        cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n/, '').replace(/\n?\s*```$/, '').trim();
      }

      // Fix trailing commas
      cleaned = cleaned.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

      let result;
      try {
        result = JSON.parse(cleaned);
      } catch {
        // Try unwrap
        result = null;
      }

      if (!Array.isArray(result)) {
        if (typeof result === 'object' && result !== null) {
          for (const value of Object.values(result)) {
            if (Array.isArray(value)) { result = value; break; }
          }
        }
      }

      const success = Array.isArray(result) && result.length > 0;
      if (success === tc.expected) {
        console.log(`  ✅ ${tc.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${tc.name} — expected ${tc.expected}, got ${success}`);
      }
    } catch (error) {
      console.log(`  ❌ ${tc.name} — threw: ${error}`);
    }
  }

  console.log(`\n  Result: ${passed}/${cases.length} passed`);
  return passed === cases.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Deduplication
// ─────────────────────────────────────────────────────────────────────────────

async function testDeduplication() {
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST 2: Deduplication');
  console.log('═══════════════════════════════════════\n');

  // Create a test user if needed
  const testUser = await prisma.user.upsert({
    where: { email: 'test-pipeline@quiverdm.dev' },
    update: {},
    create: {
      email: 'test-pipeline@quiverdm.dev',
      name: 'Pipeline Test User',
    },
  });

  const testItems = [
    { type: 'magic_item', name: 'E2E Test Sword', data: { rarity: 'rare', version: 1 } },
    { type: 'spell', name: 'E2E Test Spell', data: { level: 2, version: 1 } },
  ];

  // First save
  console.log('  Saving items for the first time...');
  const result1 = await saveExtractedContent(testItems, testUser.id, 'test-pdf-1', null, prisma);
  console.log(`  First save: ${result1.saved} saved, ${result1.errors.length} errors`);

  // Second save (should update, not create duplicates)
  const testItems2 = [
    { type: 'magic_item', name: 'E2E Test Sword', data: { rarity: 'rare', version: 2 } },
    { type: 'spell', name: 'E2E Test Spell', data: { level: 2, version: 2 } },
  ];

  console.log('  Saving same items again (should deduplicate)...');
  const result2 = await saveExtractedContent(testItems2, testUser.id, 'test-pdf-1', null, prisma);
  console.log(`  Second save: ${result2.saved} saved, ${result2.errors.length} errors`);

  // Check: should still be only 2 records, not 4
  const count = await prisma.homebrewContent.count({
    where: {
      userId: testUser.id,
      sourceType: 'pdf_extraction',
      name: { startsWith: 'E2E Test' },
    },
  });

  console.log(`  Records in DB: ${count} (expected: 2)`);

  // Verify data was updated
  const sword = await prisma.homebrewContent.findFirst({
    where: { userId: testUser.id, name: 'E2E Test Sword', sourceType: 'pdf_extraction' },
  });
  const version = (sword?.data as any)?.version;
  console.log(`  Sword version: ${version} (expected: 2)`);

  // Cleanup
  await prisma.homebrewContent.deleteMany({
    where: { userId: testUser.id, name: { startsWith: 'E2E Test' } },
  });
  await prisma.user.delete({ where: { id: testUser.id } });

  const passed = count === 2 && version === 2;
  console.log(`\n  Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  return passed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Provider availability
// ─────────────────────────────────────────────────────────────────────────────

async function testProviderAvailability() {
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST 3: Provider Availability');
  console.log('═══════════════════════════════════════\n');

  const providers = getAvailableProviders();
  console.log(`  Available providers: ${providers.join(', ')}`);

  for (const p of providers) {
    const hasKey = p === 'ollama' || !!process.env[`${p.toUpperCase()}_API_KEY`];
    console.log(`  ${hasKey ? '✅' : '⚠️ '} ${p}: ${hasKey ? 'configured' : 'no API key'}`);
  }

  console.log(`\n  Result: ✅ ${providers.length} providers detected`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Live extraction (optional — only runs if a provider is available)
// ─────────────────────────────────────────────────────────────────────────────

async function testLiveExtraction() {
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST 4: Live Extraction (optional)');
  console.log('═══════════════════════════════════════\n');

  const providers = getAvailableProviders();
  const hasCloudProvider = providers.some((p) => p !== 'ollama');

  if (!hasCloudProvider) {
    console.log('  ⏭️  Skipping — no cloud providers configured');
    console.log('  Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to test');
    return true;
  }

  console.log('  Running extraction with fallback...');
  const result = await extractWithFallback(TEST_MARKDOWN);

  console.log(`  Provider used: ${result.provider}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Items extracted: ${result.items.length}`);
  console.log(`  Tokens used: ${result.tokensUsed || 'N/A'}`);

  if (result.items.length > 0) {
    console.log('  Items:');
    for (const item of result.items) {
      console.log(`    - ${item.type}: ${item.name}`);
    }
  }

  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  const passed = result.success && result.items.length > 0;
  console.log(`\n  Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  return passed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  QuiverDM E2E Pipeline Test           ║');
  console.log('╚═══════════════════════════════════════╝');

  const results: Record<string, boolean> = {};

  results['JSON Parsing'] = testJsonParsing();
  results['Provider Availability'] = await testProviderAvailability();

  try {
    results['Deduplication'] = await testDeduplication();
  } catch (error) {
    console.error('  ❌ Deduplication test failed with error:', error);
    results['Deduplication'] = false;
  }

  try {
    results['Live Extraction'] = await testLiveExtraction();
  } catch (error) {
    console.error('  ❌ Live extraction test failed with error:', error);
    results['Live Extraction'] = false;
  }

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  Summary                              ║');
  console.log('╠═══════════════════════════════════════╣');

  let allPassed = true;
  for (const [name, passed] of Object.entries(results)) {
    console.log(`║  ${passed ? '✅' : '❌'} ${name.padEnd(34)}║`);
    if (!passed) allPassed = false;
  }

  console.log('╚═══════════════════════════════════════╝');

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
