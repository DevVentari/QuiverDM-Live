/**
 * Test script for PDF to Markdown conversion with AI enhancement
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { convertPdfToMarkdown } from '../src/lib/marker';
import path from 'path';

async function main() {
  console.log('Testing PDF conversion with AI enhancement...');
  console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);

  const pdfPath = path.join(process.cwd(), 'test-documents/homebrew-sample.pdf');
  console.log(`PDF Path: ${pdfPath}`);

  try {
    const result = await convertPdfToMarkdown(pdfPath, {
      useLLM: true,
      llmProvider: 'gemini',
    });

    console.log('\n✅ Success!');
    console.log(`Markdown length: ${result.markdown.length} characters`);
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('\nFirst 500 chars of markdown:');
    console.log(result.markdown.substring(0, 500));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
