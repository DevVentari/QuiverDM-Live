/**
 * Clear all PDFs and related data
 * Usage: npx tsx scripts/clear-pdfs.ts
 */

import { prisma } from '../src/lib/prisma';
import { storage } from '../src/lib/storage';
import fs from 'fs';
import path from 'path';

async function clearAllPDFs() {
  console.log('🗑️  Clearing all PDFs and related data...\n');

  // Get all PDFs
  const pdfs = await prisma.homebrewPDF.findMany({
    select: {
      id: true,
      filename: true,
      r2Url: true,
      markdownR2Url: true,
    },
  });

  console.log(`Found ${pdfs.length} PDFs to delete`);

  // Delete from storage
  for (const pdf of pdfs) {
    try {
      if (pdf.r2Url) {
        // Extract key from URL or use r2Url directly if it's a key
        const key = pdf.r2Url.includes('/')
          ? pdf.r2Url.split('/').pop() || pdf.r2Url
          : pdf.r2Url;
        await storage.delete(key);
        console.log(`  ✓ Deleted storage: ${pdf.filename}`);
      }
      if (pdf.markdownR2Url) {
        const key = pdf.markdownR2Url.includes('/')
          ? pdf.markdownR2Url.split('/').pop() || pdf.markdownR2Url
          : pdf.markdownR2Url;
        await storage.delete(key);
        console.log(`  ✓ Deleted markdown: ${pdf.filename}`);
      }
    } catch (err) {
      console.log(`  ⚠️  Storage cleanup error for ${pdf.filename}: ${err}`);
    }
  }

  // Note: Extracted content doesn't have a direct PDF link in schema
  // Content will remain but won't be linked to deleted PDFs
  console.log(`\n⚠️  Note: Extracted content from PDFs will remain in database`);

  // Delete all PDFs from database
  const deleteResult = await prisma.homebrewPDF.deleteMany({});
  console.log(`✓ Deleted ${deleteResult.count} PDF records from database`);

  // Clear local storage directory if it exists
  const localStoragePath = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(localStoragePath)) {
    const files = fs.readdirSync(localStoragePath);
    for (const file of files) {
      try {
        const filePath = path.join(localStoragePath, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`  ✓ Deleted local file: ${file}`);
        }
      } catch (err) {
        console.log(`  ⚠️  Could not delete ${file}: ${err}`);
      }
    }
    console.log(`✓ Cleared local storage directory`);
  }

  console.log('\n✅ All PDFs cleared successfully!');
}

clearAllPDFs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
