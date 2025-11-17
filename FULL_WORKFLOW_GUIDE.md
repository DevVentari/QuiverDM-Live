# Full Workflow Testing Guide

## ✅ Current Status

**Database**: ✅ Running and migrated
**Dev Server**: ✅ Running on http://localhost:3001
**Homebrew Router**: ✅ Enabled in tRPC

## 🔍 Issue Detected

The tRPC API is returning 404 errors. This is likely because:
1. The server needs a full restart after enabling the homebrew router
2. Or there's an import error we need to check

## 🚀 Testing Steps

### Step 1: Open the Homebrew Page

Open your browser and navigate to:
```
http://localhost:3001/homebrew
```

You should see:
- **Navigation bar** at the top
- **"My Homebrew Library"** heading
- **Stats dashboard** (will show 0 for all types)
- **Search bar** and **Type filter**
- **"Upload PDF"** and **"Create Homebrew"** buttons

### Step 2: Check Browser Console

Press `F12` to open developer tools and check the Console tab for any errors.

Look for:
- tRPC query errors
- Network errors
- API response issues

### Step 3: Manual PDF Upload Test (CLI)

Since the web UI has tRPC issues, you can test the full extraction workflow via CLI:

```bash
npm run test:ai-extract test-documents/homebrew-sample.pdf
```

This bypasses the web UI and tests the core functionality directly.

**Expected Output**:
- ✅ Extracted 4 items
- ✅ 2 items, 1 spell, 1 creature
- ✅ Cost: ~$0.001
- ✅ Results saved to JSON

### Step 4: Database Insert Test

Let's manually test inserting data into the database:

```bash
# Create a simple test script
npx tsx -e "
import { prisma } from './src/server/db';

async function test() {
  console.log('Testing database connection...');

  // Create test homebrew content
  const content = await prisma.homebrewContent.create({
    data: {
      userId: 'temp-user',
      type: 'item',
      name: 'Test Sword',
      data: { description: 'A test sword' },
      tags: ['test'],
      searchText: 'test sword',
    },
  });

  console.log('✅ Created:', content.name);

  // Query it back
  const results = await prisma.homebrewContent.findMany({
    where: { userId: 'temp-user' },
  });

  console.log('✅ Found', results.length, 'items');

  // Clean up
  await prisma.homebrewContent.delete({ where: { id: content.id } });
  console.log('✅ Cleaned up');
}

test().catch(console.error);
"
```

### Step 5: Fix tRPC Issue

The tRPC router is enabled but might need a server restart. Try:

1. **Stop the dev server**: Press `Ctrl+C` in the terminal running `npm run dev`
2. **Restart it**: Run `npm run dev` again
3. **Refresh the page**: Go to http://localhost:3001/homebrew

## 📊 What Should Work

### ✅ Already Working
- PDF text extraction
- Page rendering to images
- AI extraction with GPT-4o-mini
- Base64 image encoding
- Local file storage
- Database schema
- CLI testing

### ⏳ Needs Fix
- tRPC API endpoints (404 errors)
- Web UI data loading
- PDF upload through UI

## 🎯 Alternative: Use CLI for Now

While we fix the web UI, you can use the powerful CLI tool:

### Extract from Any PDF

```bash
npm run test:ai-extract path/to/your/homebrew.pdf
```

### Results

The script will:
1. Extract all pages
2. Send to GPT-4o-mini
3. Parse items, spells, creatures
4. Save detailed JSON results
5. Show cost breakdown

**Example with a Real PDF**:
```bash
# Download a DMs Guild homebrew PDF, then:
npm run test:ai-extract downloads/cool-homebrew.pdf
```

## 💡 Recommended Next Action

**Option A: Fix the Web UI (5-10 minutes)**
1. Restart dev server
2. Debug tRPC errors
3. Test upload through browser

**Option B: Use CLI Now (Immediate)**
1. Download D&D homebrew PDFs
2. Run extraction via CLI
3. Get results instantly

Which would you prefer?

## 📝 Notes

- The CLI extraction is **fully functional** and tested
- Database is ready and working
- AI extraction works perfectly (~$0.001 per small PDF)
- Web UI just needs the tRPC connection fixed

---

**Current Blocker**: tRPC API 404 - likely needs server restart
**Workaround**: Use CLI tool (`npm run test:ai-extract`)
**Time to Fix**: 5-10 minutes
