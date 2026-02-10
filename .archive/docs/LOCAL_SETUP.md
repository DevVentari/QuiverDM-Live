# QuiverDM Local Setup

Get QuiverDM running locally in 5 minutes.

## Prerequisites

- **Node.js 18+**
- **Docker Desktop** (for PostgreSQL, Redis, MeiliSearch)
- **Python 3.8+** (for transcription features)
- **NVIDIA GPU with CUDA** (optional, for fast transcription)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/DevVentari/QuiverDM.git
cd QuiverDM
npm install
```

### 2. Configure Environment

```bash
cp .env.local.template .env.local
```

Edit `.env.local` with your API keys (see below).

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Initialize Database

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Services Reference

| Service | URL | Purpose |
|---------|-----|---------|
| QuiverDM | localhost:3000 | Application |
| PostgreSQL | localhost:5433 | Database |
| Redis | localhost:6380 | Job queue |
| MeiliSearch | localhost:7701 | Search (optional) |
| Prisma Studio | localhost:5555 | DB GUI |

## Environment Variables

### Required

```env
# Database (Docker)
DATABASE_URL=postgresql://quiverdm:localdev@localhost:5433/quiverdm

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

### Optional - Google OAuth

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

For setup, see [docs/OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md).

### Optional - AI Services

```env
# OpenAI (for AI extraction)
OPENAI_API_KEY=sk-...

# Anthropic (for summaries)
ANTHROPIC_API_KEY=...

# HuggingFace (for speaker diarization)
HF_TOKEN=...
```

### Local Services

```env
# Redis (Docker)
REDIS_URL=redis://localhost:6380

# MeiliSearch (Docker)
MEILISEARCH_URL=http://localhost:7701
MEILISEARCH_KEY=masterKey

# Storage mode
STORAGE_MODE=local
LOCAL_STORAGE_PATH=./uploads
```

## Running Features

### PDF Processing

Requires a separate worker process:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: PDF Worker
npm run worker:pdf
```

See [docs/features/PDF_PROCESSING.md](./features/PDF_PROCESSING.md).

### Transcription

Requires Python setup:

```bash
pip install -r requirements.txt

# Test it works
npm run test:quick
```

See [docs/features/TRANSCRIPTION.md](./features/TRANSCRIPTION.md).

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run linter
npm run build            # Production build

# Database
npm run db:push          # Push schema changes
npm run db:generate      # Regenerate Prisma client
npm run db:studio        # Open Prisma Studio GUI

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose ps        # Check status
docker-compose logs -f   # View logs

# Workers
npm run worker:pdf       # Start PDF worker
npm run worker:pdf:dev   # Worker with auto-reload

# Transcription
npm run test:quick       # Quick transcription test
npm run test:transcribe  # Full workflow test
```

## Sharing Locally (ngrok)

When you need to share with playtesters:

### 1. Install ngrok

Download from [ngrok.com](https://ngrok.com/download) or:

```bash
# Windows (scoop)
scoop install ngrok

# Mac
brew install ngrok
```

### 2. Create Tunnel

```bash
ngrok http 3000
```

### 3. Share the URL

Copy the generated `https://xxxxx.ngrok.io` URL.

**Note:** Update `NEXTAUTH_URL` in `.env.local` if using OAuth with ngrok.

## Troubleshooting

### Docker services won't start

```bash
# Check Docker is running
docker info

# Restart services
docker-compose down
docker-compose up -d
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

### Port already in use

PostgreSQL uses 5433 (not 5432) and Redis uses 6380 (not 6379) to avoid conflicts with any local installations.

### Prisma client out of sync

```bash
npm run db:generate
```

Then restart the TypeScript server in your IDE.

## Next Steps

1. **Create a campaign** at `/campaigns`
2. **Upload a session recording** to test transcription
3. **Upload homebrew PDFs** to test extraction
4. **Explore the API** with Prisma Studio

## Documentation

- [Features: Transcription](./features/TRANSCRIPTION.md)
- [Features: PDF Processing](./features/PDF_PROCESSING.md)
- [Features: Homebrew](./features/HOMEBREW.md)
- [OAuth Setup](./OAUTH_SETUP_GUIDE.md)
- [API Keys Setup](./API_KEYS_SETUP_GUIDE.md)
