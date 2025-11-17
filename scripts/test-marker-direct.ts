/**
 * Direct test of Marker conversion
 */

import { convertPdfToMarkdown } from '../src/lib/marker';
import path from 'path';

async function main() {
  const testPdf = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');

  console.log('Testing Marker conversion directly...');
  console.log(`PDF: ${testPdf}`);

  try {
    const result = await convertPdfToMarkdown(testPdf, {
      useLLM: false,
    });

    console.log('\\nSuccess!');
    console.log(`Markdown length: ${result.markdown.length} characters`);
    console.log(`Metadata:`, result.metadata);
    console.log('\\nFirst 500 chars:');
    console.log(result.markdown.substring(0, 500));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
