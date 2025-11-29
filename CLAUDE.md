# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuiverDM is an AI-powered D&D session management tool for Dungeon Masters.

**Currently in active local development** - not yet deployed to production.

**Local Stack:**
- Next.js 15 (App Router) + React + TypeScript
- tRPC for type-safe API layer
- PostgreSQL + Redis + MeiliSearch (all via Docker)
- Local filesystem for uploads (`STORAGE_MODE=local`)
- WhisperX for transcription (requires Python + optional GPU)

## Quick Start

```bash
docker-compose up -d        # Start PostgreSQL, Redis, MeiliSearch
npm install
npm run db:push
npm run dev                 # http://localhost:3000
```

For PDF processing, run in separate terminal:
```bash
npm run worker:pdf
```

See `docs/LOCAL_SETUP.md` for complete setup guide.

## Development Commands

```bash
# Development
npm run dev                    # Start at http://localhost:3000
npm run lint                   # Run ESLint

# Database
npm run db:push                # Push schema changes
npm run db:generate            # Regenerate Prisma Client
npm run db:studio              # Open Prisma Studio GUI

# Docker
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose ps              # Check status

# Workers
npm run worker:pdf             # PDF processing worker
npm run worker:pdf:dev         # Worker with auto-reload

# Transcription
npm run test:quick             # Quick transcription test
npm run test:transcribe        # Full workflow test
npm run transcribe:full        # Complete session with speakers
```

## Services (Docker)

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL | localhost:5433 | Database |
| Redis | localhost:6380 | Job queue |
| MeiliSearch | localhost:7701 | Search |
| Prisma Studio | localhost:5555 | DB GUI |

## Architecture

**Frontend:**
- `src/app/` - Next.js App Router pages
- `src/components/` - React components

**Backend:**
- `src/server/routers/` - tRPC routers
- `src/lib/` - Utilities (storage, transcription, etc.)

**Database:**
- `prisma/schema.prisma` - Database schema
- Key models: Campaign, GameSession, NPC, Player, Transcript, HomebrewPDF

**Storage:**
- `src/lib/storage.ts` - Storage abstraction (local/R2)
- `src/app/api/files/[...path]/route.ts` - Local file serving
- Files stored in `./uploads/` directory

## Environment Setup

Copy `.env.local.template` to `.env.local`:

```env
# Database (Docker)
DATABASE_URL=postgresql://quiverdm:localdev@localhost:5433/quiverdm

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Storage (local by default)
STORAGE_MODE=local
LOCAL_STORAGE_PATH=./uploads

# Redis (Docker)
REDIS_URL=redis://localhost:6380

# AI Services (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
HF_TOKEN=
```

## tRPC Pattern

```typescript
// Create router: src/server/routers/your-feature.ts
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const yourRouter = router({
  getAll: publicProcedure.query(async () => {
    // Implementation
  }),
});

// Register in src/server/routers/_app.ts
export const appRouter = router({
  yourFeature: yourRouter,
});

// Use in client
const { data } = trpc.yourFeature.getAll.useQuery();
```

## Common Tasks

### Adding a Database Model
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push`
3. Prisma Client auto-regenerates

### Processing Files
```typescript
import { storage, generateFileKey } from '@/lib/storage';

// Upload
const key = generateFileKey(userId, campaignId, filename, 'pdfs');
const url = await storage.upload(key, buffer, 'application/pdf');

// Download
const data = await storage.download(key);
```

### PDF Processing
1. Upload triggers job queue
2. Worker runs Marker conversion
3. Markdown saved to database
4. See `docs/features/PDF_PROCESSING.md`

### Transcription
1. Upload video/audio
2. WhisperX processes with speaker diarization
3. See `docs/features/TRANSCRIPTION.md`

## Design System

- Dark mode by default
- Primary accent: Purple (#8B5CF6)
- Uses Radix UI Themes
- Mobile-first responsive design

## Important Notes

- **Prisma Client**: Run `npm run db:generate` after schema changes
- **Windows Paths**: Use `path.join()` for cross-platform compatibility
- **GPU**: WhisperX uses NVIDIA CUDA if available, falls back to CPU
- **Storage**: Uses local filesystem by default (`STORAGE_MODE=local`)

## Documentation

**Setup:**
- `docs/LOCAL_SETUP.md` - Getting started
- `docs/API_KEYS_SETUP_GUIDE.md` - API keys
- `docs/OAUTH_SETUP_GUIDE.md` - OAuth setup

**Features:**
- `docs/features/TRANSCRIPTION.md` - Transcription system
- `docs/features/PDF_PROCESSING.md` - PDF processing
- `docs/features/HOMEBREW.md` - Homebrew library

**Archive:**
- `docs/archive/deployment/` - Deployment docs (for future use)
