# Local-First Development Cleanup Design

**Date:** 2025-11-30
**Status:** Approved
**Goal:** Clean up project from Vercel migration attempts, establish local-only development workflow

## Context

The project became messy from back-and-forth between local and Vercel deployment. Decision made to focus on local development only for now, with occasional sharing via ngrok when needed.

**Approach:** Clean slate - remove/archive production configs, simplify docs, add local storage abstraction.

---

## 1. Documentation Structure

**New structure:**

```
docs/
├── LOCAL_SETUP.md          # Single source of truth for getting started
├── FEATURES.md             # What works, what's in progress
├── ARCHITECTURE.md         # How the codebase is organized
├── WORKFLOWS.md            # Common dev tasks (add router, run transcription, etc.)
├── archive/
│   └── deployment/         # All Vercel/Upstash/production docs moved here
│       ├── VERCEL_FRESH_DEPLOYMENT_GUIDE.md
│       ├── UPSTASH_REDIS_SETUP.md
│       └── ...
└── features/               # Deep-dive docs for specific features
    ├── TRANSCRIPTION.md    # Consolidate WHISPER_SETUP + SPEAKER_DIARIZATION
    ├── PDF_PROCESSING.md   # Consolidate PDF docs
    ├── HOMEBREW.md         # Homebrew system
    └── ...
```

---

## 2. Environment Configuration

**`.env.local.template` - local-only:**

```env
# Database (Docker)
DATABASE_URL=postgresql://quiverdm:localdev@localhost:5433/quiverdm

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-production

# Google OAuth (optional - can use email/password locally)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI Services
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# HuggingFace (for speaker diarization)
HF_TOKEN=your-token-here

# Local Services (Docker)
REDIS_URL=redis://localhost:6380
MEILISEARCH_URL=http://localhost:7701
MEILISEARCH_KEY=masterKey

# Storage - LOCAL filesystem instead of R2
STORAGE_MODE=local
LOCAL_STORAGE_PATH=./uploads
```

**Removed:** All Cloudflare R2 variables, Upstash variables.

---

## 3. LOCAL_SETUP.md Content

```markdown
# QuiverDM Local Setup

## Prerequisites
- Node.js 18+
- Docker Desktop
- Python 3.8+ (for WhisperX)
- NVIDIA GPU with CUDA (optional, for fast transcription)

## Quick Start (5 minutes)
1. Clone repo
2. Copy .env.local.template → .env.local
3. docker-compose up -d
4. npm install
5. npm run db:push
6. npm run dev
→ Open http://localhost:3000

## Services Reference
| Service    | URL                  | Purpose           |
|------------|----------------------|-------------------|
| App        | localhost:3000       | QuiverDM          |
| PostgreSQL | localhost:5433       | Database          |
| Redis      | localhost:6380       | Job queue         |
| MeiliSearch| localhost:7701       | Search (optional) |
| Prisma     | localhost:5555       | DB GUI            |

## Running Features
- PDF Processing: `npm run worker:pdf` (separate terminal)
- Transcription: Requires Python setup (see docs/features/TRANSCRIPTION.md)

## Sharing Locally (ngrok)
When you need to share with playtesters:
1. Install ngrok: https://ngrok.com
2. Run: `ngrok http 3000`
3. Share the generated URL
```

---

## 4. Storage Abstraction

**New file: `src/lib/storage.ts`**

```typescript
export interface StorageProvider {
  upload(key: string, data: Buffer): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

// LocalStorage: saves to ./uploads/, serves via Next.js API route
// R2Storage: existing Cloudflare R2 code (kept for future)

export const storage = process.env.STORAGE_MODE === 'r2'
  ? new R2Storage()
  : new LocalStorage();
```

**API route:** `/api/files/[...path]` serves local uploads.

**Directory structure:**
```
uploads/
├── recordings/
├── pdfs/
└── thumbnails/
```

Add `uploads/` to `.gitignore`.

---

## 5. CLAUDE.md Updates

**New opening:**
```markdown
## Project Overview

QuiverDM is an AI-powered D&D session management tool for Dungeon Masters.
Currently in active local development - not yet deployed to production.

**Local Stack:**
- Next.js 15 + React + TypeScript + tRPC
- PostgreSQL + Redis + MeiliSearch (all via Docker)
- Local filesystem for uploads
- WhisperX for transcription (requires Python + optional GPU)
```

**Remove references to:**
- Cloudflare R2
- Upstash Redis
- Vercel deployment
- Railway

---

## 6. Files to Archive/Remove

**Move to `docs/archive/deployment/`:**
- `docs/deployment/VERCEL_FRESH_DEPLOYMENT_GUIDE.md`
- `docs/deployment/UPSTASH_REDIS_SETUP.md`
- Other deployment-specific docs

**Consolidate into `docs/features/`:**
| Current Files | Becomes |
|---------------|---------|
| `WHISPER_SETUP.md` + `SPEAKER_DIARIZATION_SETUP.md` | `features/TRANSCRIPTION.md` |
| `PDF_PROCESSING.md` + `PDF_JOB_QUEUE_GUIDE.md` + `PDF_QUEUE_QUICK_START.md` | `features/PDF_PROCESSING.md` |
| `HOMEBREW_LIBRARY.md` + `HOMEBREW_EXTRACTION_SYSTEM.md` + `AI_HOMEBREW_EXTRACTION.md` | `features/HOMEBREW.md` |

**Delete:**
- `PDF_QUEUE_IMPLEMENTATION_SUMMARY.md` (implementation notes)
- Obsolete files in archive (case-by-case)

**Clean up root:**
- Remove `vercel.json` if present
- Remove Vercel-specific config files

---

## 7. Implementation Tasks

1. **Documentation restructure**
   - Create `docs/features/` folder
   - Create `docs/LOCAL_SETUP.md`
   - Consolidate scattered docs into feature guides
   - Archive deployment docs

2. **Environment cleanup**
   - Simplify `.env.local.template`
   - Remove production service variables

3. **Storage abstraction**
   - Create `src/lib/storage.ts` with local filesystem provider
   - Add `/api/files/[...path]` API route
   - Add `uploads/` directory and `.gitignore` entry

4. **Config cleanup**
   - Update `CLAUDE.md`
   - Update `README.md`
   - Remove/archive Vercel configs

---

## Not In Scope

- Feature audit (separate task)
- Refactoring existing code beyond storage
- Removing R2 code (kept but unused)
