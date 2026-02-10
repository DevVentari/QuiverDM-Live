# Local Development Setup - QuiverDM

## Quick Start Guide

This guide shows you how to run QuiverDM locally with **local file storage** (no cloud setup required).

### Prerequisites

- Node.js 18+ installed
- Docker Desktop (for PostgreSQL database)
- OpenAI API key (for AI extraction with OCR)

### Step 1: Clone and Install

```bash
cd C:\Projects\QuiverDM
npm install
```

### Step 2: Setup Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add:

```env
# Database (using Docker Compose)
DATABASE_URL="postgresql://quiverdm:localdev@localhost:5433/quiverdm"

# NextAuth (generate secret with: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# OpenAI API - REQUIRED for AI extraction
OPENAI_API_KEY="sk-..."
```

**Get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and paste into `.env.local`

### Step 3: Start Database

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5433`
- Redis on `localhost:6380`
- MeiliSearch on `localhost:7701`

### Step 4: Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### Step 5: Start Development Server

```bash
npm run dev
```

Visit: **http://localhost:3000**

## Local File Storage

The app is configured to use **local file storage** instead of Cloudflare R2 for development:

- PDFs stored in: `./storage/homebrew-pdfs/`
- Page images stored in: `./storage/homebrew-pages/`
- Files served via: `http://localhost:3000/api/storage/[...path]`

**No cloud setup required!** All files stay on your local machine.

## Testing Homebrew Extraction

### Option 1: Via Web UI

1. Start the dev server: `npm run dev`
2. Create a test campaign (you'll need to set up basic auth first)
3. Navigate to `/campaigns/{id}/homebrew`
4. Upload a PDF
5. Watch it extract with AI + OCR

### Option 2: Via Test Script

```bash
# Test AI extraction on a local PDF
npm run test:ai-extract test-documents/sample-homebrew.pdf
```

**What it does:**
- Extracts text from PDF
- Renders each page as PNG image
- Sends to OpenAI Vision API for OCR
- Displays extracted homebrew items
- Shows cost estimate
- Saves results to JSON

**Sample output:**
```
🧪 Testing AI Homebrew Extraction with OCR

📄 PDF: sample-homebrew.pdf
   File size: 2.45 MB

🖼️  Extracted 15 pages
   ✓ Total text length: 12,450 characters

💰 Cost Estimation:
   Model: gpt-4o-mini
   Estimated cost: $0.018
   ~19K input tokens, ~7K output tokens

🤖 Extracting homebrew content with AI...
   Progress: 15/15 pages

✅ Extraction Complete!

📊 Extraction Summary:
   Total items found: 8
   Pages processed: 15/15

📦 Items by Type:
   ⚔️ item: 3
   🐉 creature: 2
   ✨ spell: 3
```

## Folder Structure

```
QuiverDM/
├── storage/              # Local file storage (git-ignored)
│   ├── homebrew-pdfs/    # Uploaded PDFs
│   └── homebrew-pages/   # Rendered page images
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── homebrew/upload/  # Upload endpoint
│   │       └── storage/[...path]/ # File serving
│   ├── lib/
│   │   ├── local-storage.ts       # Local file adapter
│   │   ├── pdf-image-extractor.ts # PDF → Images
│   │   └── ai-homebrew-extractor.ts # AI extraction
│   └── components/homebrew/       # UI components
└── docs/                          # Documentation
```

## How It Works

### Upload Flow

```
1. User uploads PDF → /api/homebrew/upload
2. File saved to ./storage/homebrew-pdfs/{userId}/{campaignId}/
3. Record created in database with local URL
4. Processing triggered automatically
```

### AI Extraction Flow

```
1. Fetch PDF from local storage
2. Extract text with pdf.js
3. Render each page as PNG (2x resolution)
4. Save images to ./storage/homebrew-pages/
5. Send images + text to OpenAI Vision API
6. Parse structured homebrew content
7. Save to database with tags
```

### File Access

```
Frontend: /api/storage/homebrew-pdfs/user-123/campaign-456/file.pdf
Backend:  ./storage/homebrew-pdfs/user-123/campaign-456/file.pdf
```

## Features Working Locally

✅ **Upload PDFs** - Saved to local disk
✅ **AI Extraction** - Full OCR support with OpenAI
✅ **View PDFs** - Served from local storage
✅ **Page Images** - Rendered and saved locally
✅ **Search Content** - Full-text search in database
✅ **Manage Library** - All CRUD operations

## Costs

**Using OpenAI gpt-4o-mini:**
- 10-page PDF: ~$0.006 (less than 1 cent)
- 20-page PDF: ~$0.012 (1 cent)
- 50-page PDF: ~$0.030 (3 cents)

**Very affordable for testing!**

## Common Issues

### "OPENAI_API_KEY not found"

**Solution:** Add your OpenAI API key to `.env.local`:
```env
OPENAI_API_KEY="sk-..."
```

### "Database connection failed"

**Solution:** Make sure Docker is running:
```bash
docker-compose ps
# Should show postgres as "Up"

# If not, start it:
docker-compose up -d
```

### "Failed to extract PDF"

**Possible causes:**
- PDF is encrypted/password-protected
- PDF is corrupted
- Node.js out of memory (large PDF)

**Solutions:**
- Try a smaller PDF first
- Check PDF opens in Adobe Reader
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run dev`

### "Storage directory not found"

The directory is created automatically on first upload. If you get this error:

```bash
mkdir -p storage/homebrew-pdfs
mkdir -p storage/homebrew-pages
```

## Switching to Cloudflare R2 Later

When ready for production:

1. **Update environment:**
   ```env
   R2_ACCOUNT_ID="..."
   R2_ACCESS_KEY_ID="..."
   R2_SECRET_ACCESS_KEY="..."
   R2_BUCKET_NAME="quiverdm-media"
   ```

2. **Update imports in these files:**
   - `src/app/api/homebrew/upload/route.ts`
   - `src/lib/pdf-image-extractor.ts`
   - `src/lib/ai-homebrew-extractor.ts`

3. **Change:**
   ```typescript
   // From
   import { uploadToLocal } from '@/lib/local-storage';

   // To
   import { uploadToR2 } from '@/lib/r2-storage';
   ```

All functions have the same signature, so it's a simple swap!

## Next Steps

1. ✅ **Test basic upload** - Upload a small PDF
2. ✅ **Test AI extraction** - See OCR in action
3. ✅ **Browse content** - Use the homebrew library UI
4. 📝 **Add authentication** - Setup Google OAuth
5. 🎨 **Customize** - Modify UI/components
6. 🚀 **Deploy** - Switch to R2, deploy to Vercel

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run ESLint

# Database
npm run db:generate      # Regenerate Prisma client
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio GUI

# Testing
npm run test:ai-extract  # Test AI extraction
npm run test:transcribe  # Test audio transcription
npm run test:quick       # Quick whisper test

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
```

## Support

- 📚 **Full Docs**: `docs/AI_HOMEBREW_EXTRACTION.md`
- 🏠 **Main Docs**: `docs/HOMEBREW_LIBRARY.md`
- 📖 **Roadmap**: `docs/quiverdm-development-roadmap.md`

## Summary

You're now running QuiverDM locally with:

- ✅ Local file storage (no cloud required)
- ✅ AI-powered extraction with OCR
- ✅ PostgreSQL database
- ✅ Full homebrew library features
- ✅ Cost-effective testing ($0.01-0.03 per PDF)

Upload a DMs Guild PDF and watch the magic happen! 🎲✨
