# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuiverDM is an AI-powered D&D session management tool for Dungeon Masters.

**Backend-only API server in active local development** — not yet deployed. Frontend archived to `.archive/frontend-v1/`; `src/app/` contains only API routes.

**Stack:** Next.js 15 (App Router, API-only), TypeScript, tRPC, NextAuth v5 (beta), Prisma + PostgreSQL, BullMQ + Redis, MeiliSearch, Ollama (local AI), n8n (workflow automation), WhisperX (transcription), local filesystem uploads (`STORAGE_MODE=local`).

## Quick Start

```bash
docker-compose up -d        # Postgres, Redis, MeiliSearch, Ollama, n8n, n8n-mcp
npm install && npm run db:push
npm run dev                 # http://localhost:3847
npm run dev:ws              # WebSocket server (separate terminal)
npm run worker:pdf          # PDF worker (separate terminal)
```

## Development Commands

```bash
npm run dev                    # Next.js at http://localhost:3847
npm run dev:ws                 # WebSocket server
npm run lint                   # ESLint
npm run db:push                # Push schema (auto-regenerates Prisma Client)
npm run db:migrate             # Run Prisma migrations
npm run db:generate            # Regenerate Prisma Client manually
npm run db:studio              # Prisma Studio GUI
npm run worker:pdf             # PDF processing worker
npm run worker:pdf:dev         # Worker with auto-reload
npm run test:quick             # Quick transcription test
npm run test:transcribe        # Full transcription test
npm run test:e2e               # E2E upload test
npm run test:ai-extract        # AI extraction test
npm run test:pdf-queue         # PDF queue test
npm run transcribe:full        # Complete session with speakers
npm run transcribe:workshop    # Workshop transcription
npm run generate-invites       # Generate campaign invite codes
```

## Services (Docker)

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5433 | Database |
| Redis | 6380 | Job queue (BullMQ) |
| MeiliSearch | 7701 | Full-text search |
| Ollama | 11434 | Local AI models |
| n8n | 5678 | Workflow automation |
| n8n-mcp | 3001 | MCP bridge for n8n |

## Architecture

```
API Routes (src/app/api/) ──▶ tRPC Routers (14) ──▶ Services (10) ──▶ Repositories (9) ──▶ Prisma/PostgreSQL
Sidecars: BullMQ Worker (PDF), WebSocket Server, AI Providers (Ollama/Gemini/OpenAI)
```

### Directory Structure

```
src/
├── app/api/                # API routes only (auth, uploads, tRPC endpoint)
├── lib/
│   ├── ai/                 # AI extraction (ollama, gemini, orchestrator)
│   ├── storage/            # Storage abstraction (local, R2)
│   ├── transcription/      # WhisperX (whisperx, db, progress)
│   ├── pdf/                # PDF processing (marker, viewer)
│   ├── queue/              # BullMQ job queue + worker
│   ├── utils/              # Formatting, dates, slugify
│   ├── auth.ts             # NextAuth v5 config
│   ├── prisma.ts           # Prisma client singleton
│   ├── websocket-server.ts # Real-time events
│   ├── dndbeyond-api.ts    # D&D Beyond integration
│   ├── dnd-schemas.ts      # D&D content Zod schemas
│   └── homebrew-parser.ts  # Homebrew content parser
├── server/
│   ├── routers/            # 14 tRPC routers: campaigns, sessions, npcs, players,
│   │                       #   characters, members, homebrew, homebrew-pdf,
│   │                       #   homebrew-dndbeyond, homebrew-extraction,
│   │                       #   session-recordings, session-transcription,
│   │                       #   transcript, user-settings
│   ├── services/           # 10 services (authorization, campaign, session, npc,
│   │                       #   character, member, homebrew, homebrew-pdf,
│   │                       #   homebrew-dndbeyond, homebrew-extraction)
│   ├── repositories/       # 9 repositories (same domains minus authorization)
│   ├── errors/             # 8 typed error classes
│   ├── trpc.ts             # tRPC init + campaign-scoped procedures
│   └── lib/ownership.ts    # Campaign membership verification
└── instrumentation.ts      # OpenTelemetry setup
```

## Authorization

**Primary pattern** — campaign-scoped procedures in `src/server/trpc.ts`:

```typescript
campaignMemberProcedure   // Any member; adds ctx.membership
campaignDMProcedure       // OWNER or CO_DM only
campaignOwnerProcedure    // OWNER only
```

**Service-level** — `authz` for finer-grained checks:

```typescript
await authz.campaign(campaignId, userId).verify();
await authz.campaign(campaignId, userId).requirePermission('canEditNPCs');
```

Role hierarchy: `OWNER > CO_DM > PLAYER > SPECTATOR`
Permissions: `canViewNPCSecrets`, `canEditNPCs`, `canManageSessions`, `canInviteMembers`

## Error Handling

Typed errors from `src/server/errors/` — all extend `AppError`, auto-convert to `TRPCError`:

```typescript
throw new NotFoundError('campaign', campaignId);
throw new ForbiddenError.forPermission('edit', 'NPC');
throw new ValidationError.forField('email', 'Email is required');
throw new ConflictError.duplicate('campaign', 'slug');
throw new BadRequestError('Invalid input');
throw new RateLimitedError();
throw new InternalError('Unexpected failure');
```

## tRPC Pattern

```typescript
import { router, campaignDMProcedure } from '../trpc';

export const myRouter = router({
  create: campaignDMProcedure  // validates campaignId + DM role
    .input(z.object({ campaignId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.membership has role, permissions
    }),
});
```

For non-campaign endpoints, use `protectedProcedure` with manual auth checks.

## Common Tasks

### Adding a Database Model
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` (auto-regenerates Prisma Client)

### Processing Files
```typescript
import { storage, generateFileKey } from '@/lib/storage';
const key = generateFileKey(userId, campaignId, filename, 'pdfs');
await storage.upload(key, buffer, 'application/pdf');
```

### AI Extraction
Multi-provider system in `src/lib/ai/` — Ollama (default/local), Gemini, OpenAI. Orchestrated by `extraction.ts`.

### PDF Processing
Upload triggers BullMQ job → Worker runs Marker → Markdown saved to database.

### Transcription
Upload audio/video → WhisperX with speaker diarization → Transcript saved.

## Important Notes

- **Backend Only**: `src/app/` is API routes only. Frontend archived to `.archive/frontend-v1/`
- **NextAuth v5 Beta**: Config in `src/lib/auth.ts`, uses `@auth/prisma-adapter`
- **Prisma Client**: Auto-regenerates on `db:push`. Use `db:generate` for manual regen
- **Windows Paths**: Use `path.join()` for cross-platform compatibility
- **GPU**: WhisperX uses NVIDIA CUDA if available, falls back to CPU
- **Storage**: Local filesystem by default (`STORAGE_MODE=local`)
- **Authorization**: Use campaign-scoped procedures or `authz` — not legacy `verifyCampaignOwnership`

## Workflow Testing

When modifying backend workflows, check `docs/Workflows/` first:

```
docs/Workflows/
├── README.md                    # Overview and status
├── campaign-management/         # Campaign CRUD, members, invites
├── session-management/          # Sessions, recordings
├── transcription-pipeline/      # WhisperX, speaker diarization
├── pdf-processing/              # Marker, AI extraction
├── homebrew-content/            # Content types, D&D Beyond
└── character-management/        # Characters, NPCs
```

Before changes: read workflow README → baseline tests → make changes → re-test → log in `results/`.

| Workflow | Test Command |
|----------|-------------|
| Transcription | `npm run test:quick`, `npm run test:transcribe` |
| PDF Processing | `npm run worker:pdf` + upload |
| AI Extraction | `npm run test:ai-extract` |
| E2E | `npm run test:e2e` |

## Documentation

- `docs/REFACTORING-HANDOFF.md` — Architecture refactoring notes
- `docs/Workflows/README.md` — Workflow testing overview
- `docs/Workflows/*/README.md` — Individual workflow test procedures

## Maintenance

When adding services, routers, or features, update this file. Outdated CLAUDE.md causes incorrect code suggestions.
