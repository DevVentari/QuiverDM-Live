# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuiverDM is an AI-powered D&D session management tool for Dungeon Masters. It features session recording & transcription, homebrew library management, campaign tracking, and NPC management. The app is designed to be offline-capable (PWA) and mobile-first.

**Key Technologies:**
- Next.js 15 (App Router) + React + TypeScript
- tRPC for type-safe API layer
- PostgreSQL + Prisma ORM
- NextAuth.js v5 for authentication
- AI: OpenAI Whisper (transcription), Anthropic Claude (summaries)
- Cloudflare R2 for file storage
- Redis (via Upstash or local Docker) for job queuing
- MeiliSearch (optional) for search

## Development Commands

### Core Commands
```bash
# Development server
npm run dev                    # Start at http://localhost:3000

# Build & production
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Database operations
npm run db:generate            # Generate Prisma Client (run after schema changes)
npm run db:push                # Push schema to database without migrations
npm run db:migrate             # Create and apply migrations
npm run db:studio              # Open Prisma Studio (GUI) at http://localhost:5555

# Testing transcription
npm run test:transcribe        # Test full transcription workflow
npm run test:quick             # Quick transcription test
npm run transcribe:full        # Transcribe complete session

# PDF processing worker (must run separately)
npm run worker:pdf             # Start PDF processing worker
npm run worker:pdf:dev         # Start with auto-reload
```

### Docker Services
```bash
docker-compose up -d           # Start PostgreSQL, Redis, MeiliSearch
docker-compose down            # Stop services
docker-compose ps              # Check status
docker-compose logs -f         # View logs
```

**Services:**
- PostgreSQL: `localhost:5433` (user: quiverdm, password: localdev, db: quiverdm)
- Redis: `localhost:6380`
- MeiliSearch: `localhost:7701` (master key: masterKey)

## Architecture

### Application Structure

**Frontend (Next.js App Router):**
- `src/app/` - Pages using App Router
- `src/components/` - React components
- `src/app/providers.tsx` - Client-side providers (React Query, Radix Themes)

**Backend (tRPC + Server):**
- `src/server/trpc.ts` - tRPC initialization with SuperJSON transformer
- `src/server/routers/` - tRPC routers (modular API endpoints)
- `src/server/routers/_app.ts` - Root router combining all routers

**Database:**
- `prisma/schema.prisma` - Database schema with NextAuth models + QuiverDM models
- Key models: Campaign, GameSession, NPC, Player, SessionRecording, Transcript, HomebrewPDF, HomebrewContent

**Libraries & Utils:**
- `src/lib/trpc.ts` - tRPC client setup for React
- `src/lib/whisperx.ts` - WhisperX transcription with batching, alignment, and speaker diarization
- `src/lib/ffmpeg.ts` - Audio/video processing with pre-processing filters

**Scripts:**
- `scripts/test-transcription.ts` - Test transcription workflow
- `scripts/test-quick.ts` - Quick 60-second transcription test
- `scripts/transcribe-session-full.ts` - Full D&D session with speaker detection
- `scripts/transcribe_whisperx.py` - Python script for WhisperX processing

### tRPC Pattern

QuiverDM uses tRPC for end-to-end type-safe APIs. Add new endpoints by:

1. Create router in `src/server/routers/your-feature.ts`
2. Define procedures using `publicProcedure` and Zod schemas
3. Import and register in `src/server/routers/_app.ts`
4. Use in client with `trpc.yourFeature.yourProcedure.useQuery/useMutation()`

**Example:**
```typescript
// src/server/routers/campaigns.ts
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const campaignsRouter = router({
  getAll: publicProcedure.query(async () => {
    // Implementation
  }),
  create: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      // Implementation
    }),
});

// Register in _app.ts
export const appRouter = router({
  campaigns: campaignsRouter,
  // ... other routers
});
```

### Database Schema Patterns

**Key relationships:**
- User → Campaigns (one-to-many)
- Campaign → GameSessions, NPCs, Players, HomebrewContent (one-to-many)
- GameSession → SessionRecordings, Transcripts (one-to-many)

**Important fields:**
- `Campaign.glossary` (Json) - Campaign-specific terms for transcription correction
- `Transcript.speakers` (Json) - Speaker diarization data
- `HomebrewContent.data` (Json) - Flexible structure based on content type

### WhisperX Transcription System

QuiverDM uses WhisperX for enhanced transcription with batching, word-level alignment, and speaker diarization:

**WhisperX Features:**
- **Batched inference**: 2-3x faster than vanilla Whisper
- **Word-level timestamps**: Precise alignment using phoneme models
- **Voice Activity Detection (VAD)**: Automatically detects speech segments
- **Speaker diarization**: Integrated pyannote.audio for "who spoke when"
- **Audio pre-processing**: Always-on normalization and noise reduction
- Requires Python 3.8+ with `whisperx` package
- Models stored in `./models/whisper/`
- Recommended model: `medium` (best quality/speed balance)
- Batch size: 16 (balanced for 8-12GB VRAM)
- See `docs/WHISPER_SETUP.md` for setup instructions

**Workflow:**
1. Upload video/audio file
2. Pre-process audio with ffmpeg (`src/lib/ffmpeg.ts`):
   - Loudness normalization (EBU R128 standard)
   - Bandpass filter (200Hz-3000Hz for speech clarity)
   - Convert to mono @ 16kHz (optimal for Whisper)
3. Split into 10-minute chunks
4. Transcribe each chunk with WhisperX (GPU: ~20-30min, CPU: ~1.5-2hrs for 3hr session)
   - Batched transcription
   - Word-level timestamp alignment
   - Optional speaker diarization
5. Combine transcripts with proper timestamp offsets
6. Apply campaign glossary corrections (future)
7. Generate multiple output formats (plain text, with speakers, JSON)

**Performance:**
- **3-hour D&D session**: ~25-35 minutes on GPU (vs. ~45-60 with faster-whisper)
- **30-40% faster** than previous implementation
- Better accuracy for speaker boundaries and timestamps

**Key files:**
- `src/lib/whisperx.ts` - WhisperX transcription interface
- `src/lib/ffmpeg.ts` - Audio pre-processing and extraction
- `scripts/transcribe_whisperx.py` - Python WhisperX script (unified basic + speaker)
- `src/server/routers/session-transcription.ts` - tRPC endpoints

## Environment Setup

**Required Variables:**
```env
# Database
DATABASE_URL=postgresql://quiverdm:localdev@localhost:5433/quiverdm

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

# AI Services
OPENAI_API_KEY=<from OpenAI platform>
ANTHROPIC_API_KEY=<from Anthropic console>

# Storage
R2_ACCOUNT_ID=<from Cloudflare>
R2_ACCESS_KEY_ID=<from Cloudflare>
R2_SECRET_ACCESS_KEY=<from Cloudflare>
R2_BUCKET_NAME=quiverdm-media-dev
```

See `.env.local.template` for complete list and `docs/API_KEYS_SETUP_GUIDE.md` for detailed setup.

## Design System

**Theme:**
- Dark mode by default
- Primary accent: Purple (#8B5CF6 - violet-500)
- Uses Radix UI Themes (@radix-ui/themes)
- Mobile-first responsive design
- Framer Motion for animations

**Import paths:**
- Use `@/*` aliases (configured in tsconfig.json)
- Example: `import { Button } from '@/components/Button'`

## Code Patterns & Conventions

### Database Mutations
Always use Prisma transactions for related writes:
```typescript
await prisma.$transaction([
  prisma.campaign.create({ data: campaignData }),
  prisma.player.createMany({ data: playerData }),
]);
```

### Error Handling
Use tRPC error handling:
```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Campaign not found',
});
```

### Testing Transcription
Before deploying transcription features, test with:
```bash
npm run test:quick           # Quick 60-second test (WhisperX availability check)
npm run test:transcribe      # Full workflow test with medium model
npm run transcribe:full      # Complete D&D session with speaker diarization
```

### PDF Processing with Job Queue
QuiverDM uses BullMQ + Redis for durable background PDF processing:

**Development workflow:**
```bash
# Terminal 1: Start Redis
docker-compose up -d redis

# Terminal 2: Start Next.js
npm run dev

# Terminal 3: Start PDF worker (required!)
npm run worker:pdf
```

**Key features:**
- ✅ Durable: Jobs survive server crashes (persisted to Redis)
- ✅ Automatic retry: Up to 3 attempts with exponential backoff
- ✅ Concurrency control: Default limit of 2 simultaneous PDFs
- ✅ Progress tracking: Real-time 0-100% updates
- ✅ Job management: Cancel, retry, view queue stats

See `docs/PDF_QUEUE_QUICK_START.md` for quick start guide and `docs/PDF_JOB_QUEUE_GUIDE.md` for full documentation.

### Local Development GPU
To disable GPU and use CPU for testing (faster startup):
```bash
USE_GPU=false npm run test:quick
USE_GPU=false npm run test:transcribe
```

**Note**: CPU transcription is significantly slower but works without CUDA/GPU.

## Common Tasks

### Adding a New Database Model
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` (development) or `npm run db:migrate` (production)
3. Prisma Client auto-regenerates; restart TypeScript server if needed

### Adding a New tRPC Router
1. Create `src/server/routers/your-router.ts`
2. Define procedures with Zod validation
3. Export router and import in `src/server/routers/_app.ts`
4. Add to `appRouter` object

### Processing Video/Audio Files
1. Upload to Cloudflare R2
2. Use `src/lib/ffmpeg.ts` to extract/convert audio (with automatic pre-processing)
3. Create chunks with `splitAudioIntoChunks()`
4. Transcribe with `transcribeWithWhisperX()` or `transcribeChunksWithWhisperX()`
5. Store result in `Transcript` model with speaker data (if enabled)

**Speaker Diarization**:
- Set `HF_TOKEN` environment variable or save to `~/.huggingface/token`
- Accept pyannote model agreements on HuggingFace
- Pass `speakerNames` array to map detected speakers to player names
- See `docs/SPEAKER_DIARIZATION_SETUP.md` for details

## Important Notes

- **Prisma Client**: After schema changes, run `npm run db:generate` to regenerate the client
- **SuperJSON**: tRPC uses SuperJSON transformer - supports Date, Map, Set, BigInt, etc.
- **Windows Paths**: Use path.join() for cross-platform compatibility; Python scripts expect escaped paths
- **GPU Requirements**: NVIDIA GPU with CUDA for WhisperX; automatically falls back to CPU
- **Docker Database**: PostgreSQL runs on port 5433 (not 5432) to avoid conflicts
- **Audio Pre-processing**: Always enabled by default for best transcription quality
- **Batch Size**: Default batch_size=16 balances speed/VRAM for most GPUs (8-12GB)

## Documentation

- `README.md` - Getting started guide
- `docs/quiverdm-development-roadmap.md` - Feature roadmap and development phases
- `docs/WHISPER_SETUP.md` - Detailed transcription setup
- `docs/SPEAKER_DIARIZATION_SETUP.md` - Speaker identification setup
- `docs/API_KEYS_SETUP_GUIDE.md` - Comprehensive API key setup
- `docs/PDF_QUEUE_QUICK_START.md` - Quick start guide for PDF job queue
- `docs/PDF_JOB_QUEUE_GUIDE.md` - Complete PDF processing job queue documentation
- `SETUP_CHECKLIST.md` - Step-by-step setup checklist
