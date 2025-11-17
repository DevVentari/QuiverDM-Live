import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('Fixing client-side tRPC calls...\n');

const filesToFix = [
  'src/app/campaigns/page.tsx',
  'src/app/campaigns/[campaignId]/homebrew/page.tsx',
  'src/app/campaigns/[campaignId]/npcs/page.tsx',
  'src/app/campaigns/[campaignId]/page.tsx',
  'src/app/homebrew/page.tsx',
];

for (const file of filesToFix) {
  console.log(`Fixing ${file}...`);
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // Fix campaigns.getAll - remove userId parameter
  if (content.includes('campaigns.getAll.useQuery')) {
    content = content.replace(
      /trpc\.campaigns\.getAll\.useQuery\(\{\s*userId:.*?\}\)/gs,
      'trpc.campaigns.getAll.useQuery()'
    );
    modified = true;
    console.log('  ✓ Fixed campaigns.getAll');
  }

  // Fix homebrew.getContent - remove userId if it's the only parameter
  content = content.replace(
    /trpc\.homebrew\.getContent\.useQuery\(\{\s*userId:\s*['"`][^'"`]*['"`]\s*\}\)/g,
    'trpc.homebrew.getContent.useQuery({})'
  );
  content = content.replace(
    /trpc\.homebrew\.getContent\.useQuery\(\{\s*userId:\s*userId\s*\}\)/g,
    'trpc.homebrew.getContent.useQuery({})'
  );

  // Fix homebrew.getContent - remove userId parameter but keep other params
  content = content.replace(
    /trpc\.homebrew\.getContent\.useQuery\(\{\s*userId:\s*['"`][^'"`]*['"`],/g,
    'trpc.homebrew.getContent.useQuery({'
  );
  content = content.replace(
    /trpc\.homebrew\.getContent\.useQuery\(\{\s*userId:\s*userId,/g,
    'trpc.homebrew.getContent.useQuery({'
  );

  // Fix homebrew.getContentStats - remove userId parameter
  content = content.replace(
    /trpc\.homebrew\.getContentStats\.useQuery\(\{\s*userId:\s*['"`][^'"`]*['"`]\s*\}\)/g,
    'trpc.homebrew.getContentStats.useQuery({})'
  );
  content = content.replace(
    /trpc\.homebrew\.getContentStats\.useQuery\(\{\s*userId:\s*userId\s*\}\)/g,
    'trpc.homebrew.getContentStats.useQuery({})'
  );
  content = content.replace(
    /trpc\.homebrew\.getContentStats\.useQuery\(\{\s*userId:\s*['"`][^'"`]*['"`],/g,
    'trpc.homebrew.getContentStats.useQuery({'
  );

  // Remove unused userId variable declarations if they're no longer used
  // This is a simple check - only remove if userId = 'temp-user-id'
  if (!content.match(/\buse[A-Z][a-z]+\([^)]*userId[^)]*\)/)) {
    content = content.replace(/\s*const userId = ['"`]temp-user-id['"`];?\s*\n/g, '\n');
    content = content.replace(/\s*const userId = ['"`]temp-user['"`];?\s*\n/g, '\n');
  }

  if (modified || content !== readFileSync(file, 'utf-8')) {
    writeFileSync(file, content, 'utf-8');
    console.log(`  ✅ ${file} updated\n`);
  } else {
    console.log(`  ⏭️  ${file} - no changes needed\n`);
  }
}

console.log('✅ All client-side calls fixed!');
