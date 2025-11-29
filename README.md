# QuiverDM

AI-Powered D&D Session Management for Dungeon Masters

## Features

- **Session Recording & Transcription**: Upload audio/video recordings and get AI-generated transcripts with speaker diarization
- **Homebrew Library**: Import PDFs of homebrew content and organize items, creatures, and spells with AI extraction
- **Campaign Management**: Track NPCs, sessions, and player notes in one centralized tool

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL, Redis, MeiliSearch)
- Python 3.8+ (for transcription)

### Installation

```bash
# Clone and install
git clone https://github.com/DevVentari/QuiverDM.git
cd QuiverDM
npm install

# Configure environment
cp .env.local.template .env.local

# Start services
docker-compose up -d

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

For PDF processing, run in a separate terminal:
```bash
npm run worker:pdf
```

**Full setup guide:** [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Backend**: tRPC, Prisma ORM
- **Database**: PostgreSQL (Docker)
- **Queue**: Redis + BullMQ (Docker)
- **Search**: MeiliSearch (Docker)
- **AI**: WhisperX (local transcription), OpenAI, Anthropic
- **Auth**: NextAuth.js v5

## Documentation

- [Local Setup Guide](docs/LOCAL_SETUP.md)
- [Transcription System](docs/features/TRANSCRIPTION.md)
- [PDF Processing](docs/features/PDF_PROCESSING.md)
- [Homebrew Library](docs/features/HOMEBREW.md)

## Development

```bash
npm run dev              # Start development server
npm run db:studio        # Open Prisma Studio (database GUI)
npm run worker:pdf       # Start PDF processing worker
npm run test:quick       # Test transcription setup
```

## License

Private - All Rights Reserved

## Contact

DevVentari - [@DevVentari](https://github.com/DevVentari)
