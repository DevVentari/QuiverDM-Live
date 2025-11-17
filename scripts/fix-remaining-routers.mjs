import { readFileSync, writeFileSync } from 'fs';

console.log('Fixing remaining routers...\n');

// Fix docling.ts
console.log('Fixing src/server/routers/docling.ts...');
let doclingContent = readFileSync('src/server/routers/docling.ts', 'utf-8');

// Add protectedProcedure
if (!doclingContent.includes('protectedProcedure')) {
  doclingContent = doclingContent.replace(
    'import { router, publicProcedure }',
    'import { router, publicProcedure, protectedProcedure }'
  );
}

// Add ownership imports
if (!doclingContent.includes('verifyHomebrewPDFOwnership')) {
  const lastImportIndex = doclingContent.lastIndexOf('import ');
  const nextNewlineAfterImport = doclingContent.indexOf('\n', lastImportIndex);
  const ownershipImport = `import { verifyHomebrewPDFOwnership } from '../lib/ownership';\n`;
  doclingContent = doclingContent.slice(0, nextNewlineAfterImport + 1) + ownershipImport + doclingContent.slice(nextNewlineAfterImport + 1);
}

// Convert all publicProcedure to protectedProcedure
doclingContent = doclingContent.replace(/(\w+):\s+publicProcedure/g, '$1: protectedProcedure');

// Add ctx and userId to all procedures
doclingContent = doclingContent.replace(/\.(query|mutation)\(async \(\{ input \}\) => \{/g, (match, type) => {
  return `.${type}(async ({ input, ctx }) => {\n      const userId = ctx.session.user.id;`;
});

// For processSourcebook - keep the existing userId check but also verify ownership
doclingContent = doclingContent.replace(
  /(processSourcebook:[\s\S]*?const userId = ctx\.session\.user\.id;[\s\S]*?const pdf = await prisma\.homebrewPDF\.findUnique)/,
  (match) => {
    if (!match.includes('verifyHomebrewPDFOwnership')) {
      return match.replace(
        'const userId = ctx.session.user.id;',
        'const userId = ctx.session.user.id;\n      await verifyHomebrewPDFOwnership(input.pdfId, userId);'
      );
    }
    return match;
  }
);

// Add verification to getChapters
doclingContent = doclingContent.replace(
  /(getChapters:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      await verifyHomebrewPDFOwnership(input.pdfId, userId);'
);

// Add verification to getChapter
doclingContent = doclingContent.replace(
  /(getChapter:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      // Verification done via chapter → pdf lookup'
);

// Add verification to getContentForPage
doclingContent = doclingContent.replace(
  /(getContentForPage:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      await verifyHomebrewPDFOwnership(input.pdfId, userId);'
);

// Add verification to getDocumentStructure
doclingContent = doclingContent.replace(
  /(getDocumentStructure:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      await verifyHomebrewPDFOwnership(input.pdfId, userId);'
);

// Add verification to estimateSourcebookCost
doclingContent = doclingContent.replace(
  /(estimateSourcebookCost:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      await verifyHomebrewPDFOwnership(input.pdfId, userId);'
);

writeFileSync('src/server/routers/docling.ts', doclingContent, 'utf-8');
console.log('  ✅ docling.ts fixed!');

// Fix homebrew-dndbeyond.ts
console.log('\nFixing src/server/routers/homebrew-dndbeyond.ts...');
let ddbContent = readFileSync('src/server/routers/homebrew-dndbeyond.ts', 'utf-8');

// Add protectedProcedure
if (!ddbContent.includes('protectedProcedure')) {
  ddbContent = ddbContent.replace(
    'import { router, publicProcedure }',
    'import { router, publicProcedure, protectedProcedure }'
  );
}

// Add ownership imports
if (!ddbContent.includes('verifyHomebrewOwnership')) {
  const lastImportIndex = ddbContent.lastIndexOf('import ');
  const nextNewlineAfterImport = ddbContent.indexOf('\n', lastImportIndex);
  const ownershipImport = `import { verifyHomebrewOwnership } from '../lib/ownership';\n`;
  ddbContent = ddbContent.slice(0, nextNewlineAfterImport + 1) + ownershipImport + ddbContent.slice(nextNewlineAfterImport + 1);
}

// Convert all publicProcedure to protectedProcedure
ddbContent = ddbContent.replace(/(\w+):\s+publicProcedure/g, '$1: protectedProcedure');

// Add ctx and userId to all procedures
ddbContent = ddbContent.replace(/\.(query|mutation)\(async \(\{ input \}\) => \{/g, (match, type) => {
  return `.${type}(async ({ input, ctx }) => {\n      const userId = ctx.session.user.id;`;
});

// For importHomebrewFromDDB - remove userId from input
ddbContent = ddbContent.replace(
  /importHomebrewFromDDB:[\s\S]*?\.input\(\s+z\.object\(\{[\s\S]*?userId: z\.string\(\),/,
  (match) => match.replace('userId: z.string(),', '')
);

// Fix the mutation to not use input.userId
ddbContent = ddbContent.replace(
  /userId: input\.userId,/g,
  'userId,'
);

// Add verification to exportToDnDBeyondFormat
ddbContent = ddbContent.replace(
  /(exportToDnDBeyondFormat:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      await verifyHomebrewOwnership(input.homebrewId, userId);'
);

// Add verification to exportMultipleToDnDBeyond
ddbContent = ddbContent.replace(
  /(exportMultipleToDnDBeyond:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
  '$1\n      // Verify all homebrew items belong to user\n      for (const homebrewId of input.homebrewIds) {\n        await verifyHomebrewOwnership(homebrewId, userId);\n      }'
);

// For checkDuplicateByDnDBeyondId - remove userId from input
ddbContent = ddbContent.replace(
  /checkDuplicateByDnDBeyondId:[\s\S]*?\.input\(\s+z\.object\(\{[\s\S]*?userId: z\.string\(\),/,
  (match) => match.replace('userId: z.string(),', '')
);

// Fix where clause to use ctx userId
ddbContent = ddbContent.replace(
  /userId: input\.userId,\s+dndBeyondId: input\.dndBeyondId/,
  'userId,\n        dndBeyondId: input.dndBeyondId'
);

writeFileSync('src/server/routers/homebrew-dndbeyond.ts', ddbContent, 'utf-8');
console.log('  ✅ homebrew-dndbeyond.ts fixed!');

console.log('\n✅ All remaining routers fixed!');
