# QuiverDM - Quick Start (Local Development)

Get started in 5 minutes with **local file storage** - no cloud setup required!

## Prerequisites

- Node.js 18+
- Docker Desktop
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://quiverdm:localdev@localhost:5433/quiverdm"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# OpenAI (REQUIRED for AI extraction)
OPENAI_API_KEY="sk-..."
```

### 3. Start Services

```bash
# Start database
docker-compose up -d

# Setup database
npm run db:generate
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Visit **http://localhost:3000**

## Features Ready to Use

✅ **Homebrew Library** - Upload PDFs, extract with AI + OCR
✅ **Local Storage** - All files saved locally (no cloud)
✅ **AI Extraction** - GPT-4o-mini with vision for OCR
✅ **Session Transcription** - WhisperX with speaker diarization

## Test AI Extraction

### Via Test Script

```bash
npm run test:ai-extract test-documents/your-pdf.pdf
```

### Via Web UI

1. Create a test campaign
2. Go to `/campaigns/{id}/homebrew`
3. Upload a PDF
4. Watch AI extract content with OCR!

## Costs

**OpenAI gpt-4o-mini:**
- 10-page PDF: <$0.01
- 20-page PDF: ~$0.01-0.02
- 50-page PDF: ~$0.03-0.05

**Very affordable for development!**

## Storage Location

Files stored in:
```
./storage/homebrew-pdfs/     # Uploaded PDFs
./storage/homebrew-pages/    # Rendered page images
```

## Next Steps

📚 **Full Setup Guide**: [LOCAL_DEVELOPMENT_SETUP.md](docs/LOCAL_DEVELOPMENT_SETUP.md)
🤖 **AI Extraction Docs**: [AI_HOMEBREW_EXTRACTION.md](docs/AI_HOMEBREW_EXTRACTION.md)
📖 **Feature Roadmap**: [quiverdm-development-roadmap.md](docs/quiverdm-development-roadmap.md)

## Support

Having issues? Check:
1. Docker is running: `docker-compose ps`
2. Database is accessible: `npm run db:studio`
3. Environment variables set correctly
4. OpenAI API key is valid

## Summary

You're ready to:
- ✅ Upload homebrew PDFs
- ✅ Extract with AI + OCR
- ✅ Transcribe D&D sessions
- ✅ Manage campaigns

**No cloud setup required - everything runs locally!** 🎲

---

*Ready for production? See [HOMEBREW_LIBRARY.md](docs/HOMEBREW_LIBRARY.md) for Cloudflare R2 setup.*
