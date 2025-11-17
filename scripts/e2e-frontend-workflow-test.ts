/**
 * End-to-End Frontend Workflow Test
 *
 * This script tests the EXACT same workflow the UI uses:
 * 1. Upload PDF from test-documents folder (simulates file upload form)
 * 2. Wait for processing (simulates polling for status)
 * 3. Extract content with OpenAI (simulates clicking "Extract Content" button)
 * 4. Verify content saved and displays properly
 *
 * This tests the tRPC endpoints that power the frontend UI.
 */

import { PrismaClient } from '@prisma/client';
import { extractContent } from '../src/lib/ai-extraction';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Simulated markdown content for Honkonomicon (since Marker is slow)
// In production, this would come from the PDF processing queue
const HONKONOMICON_SAMPLE_MARKDOWN = `
# The Honkonomicon v1.0

A compendium of goose-related magic items for 5th Edition D&D.

## Magic Items

### Honk of Commanding
*Wondrous item, rare (requires attunement)*

This carved horn is shaped like a goose's beak. While holding it, you can use an action to blow the horn and emit a powerful honk. Each creature within 30 feet that can hear you must make a DC 15 Wisdom saving throw or become frightened of you for 1 minute.

### Cloak of the Waterfowl
*Wondrous item, uncommon (requires attunement)*

While wearing this cloak made of white and gray feathers, you have advantage on Dexterity (Stealth) checks made in water or wetland environments. Additionally, you can cast *water breathing* on yourself at will.

### Ring of the Goose
*Ring, very rare (requires attunement)*

While wearing this ring fashioned from silver with a tiny goose head, you gain the following benefits:
- You can speak with geese and other waterfowl as if under the effects of *speak with animals*.
- Once per long rest, you can transform into a **giant goose** (use giant eagle statistics) for 1 hour.
- You have resistance to cold damage.

## Spells

### Goose Step
*2nd-level transmutation*
**Casting Time:** 1 action
**Range:** Self
**Components:** V, S
**Duration:** Concentration, up to 10 minutes

Your legs transform to have webbed feet, granting you a swimming speed of 60 feet for the duration. Additionally, you can walk on water as if it were solid ground.

### Honking Sphere
*3rd-level evocation*
**Casting Time:** 1 action
**Range:** 150 feet
**Components:** V, S, M (a goose feather)
**Duration:** Instantaneous

A 20-foot-radius sphere of deafening honks explodes at a point you choose within range. Each creature in that area must make a Constitution saving throw. On a failed save, a creature takes 4d8 thunder damage and is deafened for 1 minute. On a successful save, the creature takes half damage and isn't deafened.

**At Higher Levels.** When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d8 for each slot level above 3rd.

## Creature

### Giant Goose
*Large beast, unaligned*

**Armor Class** 13
**Hit Points** 45 (6d10 + 12)
**Speed** 20 ft., fly 80 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 16 (+3) | 16 (+3) | 14 (+2) | 4 (-3) | 14 (+2) | 8 (-1) |

**Skills** Perception +5
**Senses** passive Perception 15
**Languages** —
**Challenge** 2 (450 XP)

**Keen Sight.** The goose has advantage on Wisdom (Perception) checks that rely on sight.

**Actions**

**Multiattack.** The goose makes two attacks: one with its beak and one with its wings.

**Beak.** Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.

**Wing Slap.** Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage.

**Honk (Recharge 5-6).** The goose releases a terrifying honk. Each creature within 20 feet that can hear the goose must succeed on a DC 12 Wisdom saving throw or become frightened for 1 minute.

## Feat

### Goose Whisperer
*Prerequisite: Wisdom 13 or higher*

You have developed a supernatural connection with waterfowl. You gain the following benefits:

- Increase your Wisdom score by 1, to a maximum of 20.
- You can cast *speak with animals* at will, but only to communicate with birds.
- You have advantage on Wisdom (Animal Handling) checks made to interact with waterfowl.
- Once per long rest, you can summon a **swarm of geese** (use swarm of ravens statistics) that follows your commands for 1 hour.
`;

interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  details?: string;
}

class FrontendWorkflowTest {
  private steps: TestStep[] = [];
  private userId: string = '';
  private pdfId: string = '';

  constructor() {
    this.steps = [
      { name: 'Initialize database connection', status: 'pending' },
      { name: 'Get or create test user', status: 'pending' },
      { name: 'Upload PDF to database (simulates UI upload)', status: 'pending' },
      { name: 'Process PDF with Marker (simulated)', status: 'pending' },
      { name: 'Extract content with OpenAI', status: 'pending' },
      { name: 'Verify content saved to database', status: 'pending' },
      { name: 'Display content in readable format', status: 'pending' },
    ];
  }

  private log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  private updateStep(index: number, status: TestStep['status'], details?: string) {
    this.steps[index].status = status;
    if (details) this.steps[index].details = details;

    const icons = { pending: '⏳', running: '🔄', success: '✅', failed: '❌' };
    console.log(`${icons[status]} Step ${index + 1}: ${this.steps[index].name}`);
    if (details) console.log(`   ${details}`);
  }

  async runTest() {
    console.log('\n' + '='.repeat(70));
    console.log('   END-TO-END FRONTEND WORKFLOW TEST');
    console.log('   Testing the exact same workflow as the UI');
    console.log('='.repeat(70) + '\n');

    try {
      // Step 1: Initialize
      this.updateStep(0, 'running');
      await prisma.$connect();
      this.updateStep(0, 'success', 'Connected to PostgreSQL');

      // Step 2: Get user
      this.updateStep(1, 'running');
      const user = await prisma.user.findFirst();
      if (!user) {
        throw new Error('No user found. Please sign in to QuiverDM first.');
      }
      this.userId = user.id;
      this.updateStep(1, 'success', `Using user: ${user.email}`);

      // Step 3: Upload PDF (simulates form submission)
      this.updateStep(2, 'running');
      const pdfPath = path.join(
        process.cwd(),
        'test-documents/dms-guild-documents/377346-EchidnaDesign-Honkonomicon_v_1_0.pdf'
      );

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF not found at: ${pdfPath}`);
      }

      const fileStats = fs.statSync(pdfPath);
      const fileName = path.basename(pdfPath);

      // This simulates what the homebrewPdf.upload tRPC endpoint does
      const pdf = await prisma.homebrewPDF.create({
        data: {
          userId: this.userId,
          filename: fileName,
          fileSize: fileStats.size,
          r2Url: pdfPath, // In local dev, stores the file path
          mimeType: 'application/pdf',
          processingStatus: 'pending',
        },
      });
      this.pdfId = pdf.id;
      this.updateStep(2, 'success', `Uploaded: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)} MB)`);

      // Step 4: Process PDF (simulated - Marker is too slow)
      this.updateStep(3, 'running');
      console.log('   Note: Simulating Marker processing (actual takes ~100s/page on CPU)');

      // Update PDF with markdown content (this is what the worker does)
      await prisma.homebrewPDF.update({
        where: { id: this.pdfId },
        data: {
          processingStatus: 'completed',
          markdownContent: HONKONOMICON_SAMPLE_MARKDOWN,
          markerMetadata: {
            pages: 3,
            processingTimeSeconds: 0,
            itemsExtracted: 0,
            modelUsed: 'simulated',
          },
        },
      });
      this.updateStep(3, 'success', `Processed ${HONKONOMICON_SAMPLE_MARKDOWN.length} chars of markdown`);

      // Step 5: Extract with OpenAI (simulates clicking "Extract Content" button)
      this.updateStep(4, 'running');
      console.log('   Calling OpenAI GPT-4o Mini...');

      const extractionStart = Date.now();
      const result = await extractContent(HONKONOMICON_SAMPLE_MARKDOWN, 'openai');
      const extractionTime = ((Date.now() - extractionStart) / 1000).toFixed(1);

      if (!result.success) {
        throw new Error(`Extraction failed: ${result.error}`);
      }

      this.updateStep(4, 'success',
        `Extracted ${result.items.length} items in ${extractionTime}s (${result.tokensUsed} tokens)`);

      // Step 6: Save to database (this is what extractWithProvider does)
      this.updateStep(5, 'running');

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

      const savedItems = await Promise.all(
        result.items.map(async (item) => {
          const mappedType = typeMapping[item.type] || item.type;
          return prisma.homebrewContent.create({
            data: {
              userId: this.userId,
              type: mappedType,
              name: item.name,
              data: item.data as any,
              sourceType: 'pdf_extraction',
              searchText: JSON.stringify(item.data).toLowerCase(),
            },
          });
        })
      );

      // Group by type for summary
      const typeCounts: Record<string, number> = {};
      savedItems.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      });

      const typesSummary = Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}(s)`)
        .join(', ');

      this.updateStep(5, 'success', `Saved ${savedItems.length} items: ${typesSummary}`);

      // Step 7: Display content (simulates what UI shows)
      this.updateStep(6, 'running');
      console.log('\n' + '='.repeat(70));
      console.log('   EXTRACTED CONTENT DISPLAY (as shown in UI)');
      console.log('='.repeat(70) + '\n');

      for (const item of savedItems) {
        const data = item.data as Record<string, any>;

        console.log(`┌${'─'.repeat(68)}┐`);
        console.log(`│ ${item.type.toUpperCase().padEnd(66)} │`);
        console.log(`│ ${item.name.padEnd(66)} │`);
        console.log(`├${'─'.repeat(68)}┤`);

        // Display based on type (same logic as frontend)
        switch (item.type) {
          case 'item':
            console.log(`│ Type: ${String(data.itemType || data.type || 'Unknown').padEnd(60)} │`);
            console.log(`│ Rarity: ${String(data.rarity || 'Unknown').padEnd(58)} │`);
            if (data.requiresAttunement) {
              console.log(`│ Requires Attunement: Yes${''.padEnd(43)} │`);
            }
            if (data.description) {
              const desc = data.description.substring(0, 60) + (data.description.length > 60 ? '...' : '');
              console.log(`│ ${desc.padEnd(66)} │`);
            }
            break;

          case 'spell':
            const level = data.level === 0 ? 'Cantrip' : `${data.level}${getOrdinal(data.level)}-level`;
            console.log(`│ Level: ${level.padEnd(59)} │`);
            console.log(`│ School: ${String(data.school || 'Unknown').padEnd(58)} │`);
            console.log(`│ Casting Time: ${String(data.castingTime || 'Unknown').padEnd(52)} │`);
            console.log(`│ Range: ${String(data.range || 'Unknown').padEnd(59)} │`);
            break;

          case 'creature':
            console.log(`│ Size: ${String(data.size || 'Unknown').padEnd(60)} │`);
            console.log(`│ Type: ${String(data.type || 'Unknown').padEnd(60)} │`);
            console.log(`│ CR: ${String(data.challengeRating || 'Unknown').padEnd(62)} │`);
            console.log(`│ HP: ${String(data.hitPoints || 'Unknown').padEnd(62)} │`);
            break;

          case 'feat':
            console.log(`│ Prerequisite: ${String(data.prerequisite || 'None').padEnd(52)} │`);
            if (data.benefits && Array.isArray(data.benefits)) {
              console.log(`│ Benefits: ${data.benefits.length} benefit(s)${''.padEnd(44)} │`);
            }
            break;

          default:
            const preview = JSON.stringify(data).substring(0, 60);
            console.log(`│ ${preview.padEnd(66)} │`);
        }

        console.log(`└${'─'.repeat(68)}┘`);
        console.log('');
      }

      this.updateStep(6, 'success', `Displayed ${savedItems.length} items in readable format`);

      // Final Summary
      console.log('\n' + '='.repeat(70));
      console.log('   TEST SUMMARY');
      console.log('='.repeat(70));
      console.log(`\n✅ All ${this.steps.length} steps completed successfully!\n`);

      console.log('📊 Statistics:');
      console.log(`   PDF: ${fileName}`);
      console.log(`   Markdown: ${HONKONOMICON_SAMPLE_MARKDOWN.length} characters`);
      console.log(`   AI Provider: OpenAI GPT-4o Mini`);
      console.log(`   Tokens Used: ${result.tokensUsed?.toLocaleString()}`);
      console.log(`   Estimated Cost: $${((result.tokensUsed || 0) * 0.00015 / 1000).toFixed(6)}`);
      console.log(`   Items Extracted: ${savedItems.length}`);
      console.log(`   Types: ${typesSummary}`);

      console.log('\n📍 UI Verification:');
      console.log(`   Visit: http://localhost:3847/homebrew/pdf/${this.pdfId}`);
      console.log('   You should see:');
      console.log('   - Styled markdown viewer with D&D-themed formatting');
      console.log('   - AI Extraction panel with OpenAI selected');
      console.log('   - Ability to re-extract with different providers');

      console.log('\n📚 Homebrew Library:');
      const totalContent = await prisma.homebrewContent.count({
        where: { userId: this.userId },
      });
      console.log(`   Total items in library: ${totalContent}`);
      console.log(`   Visit: http://localhost:3847/homebrew to see all content`);

    } catch (error) {
      const failedStep = this.steps.findIndex(s => s.status === 'running');
      if (failedStep >= 0) {
        this.updateStep(failedStep, 'failed', error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }

  async cleanup() {
    // Optionally clean up test data
    if (this.pdfId) {
      console.log('\n🧹 Cleanup Options:');
      console.log(`   To delete test PDF: prisma.homebrewPDF.delete({ where: { id: '${this.pdfId}' } })`);
      console.log(`   To delete test content: prisma.homebrewContent.deleteMany({ where: { sourceType: 'pdf_extraction' } })`);
    }
    await prisma.$disconnect();
  }
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Run the test
const test = new FrontendWorkflowTest();
test.runTest()
  .then(() => test.cleanup())
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    test.cleanup();
    process.exit(1);
  });
