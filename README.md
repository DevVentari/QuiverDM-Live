# QuiverDM

AI-Powered D&D Session Management for Dungeon Masters

## Features

- 📼 **Session Recording & Transcription**: Upload audio/video recordings and get AI-generated transcripts with campaign-specific corrections
- 📚 **Homebrew Library**: Import PDFs of homebrew content and organize items, creatures, and spells with AI categorization
- 🎭 **Campaign Management**: Track NPCs, sessions, and player notes in one centralized, offline-capable tool

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, tRPC
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI (Whisper), Anthropic Claude
- **Storage**: Cloudflare R2
- **Auth**: NextAuth.js v5
- **Queue**: Upstash Redis + BullMQ
- **Search**: MeiliSearch (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/DevVentari/QuiverDM.git
cd QuiverDM
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration.

4. Set up the database:
```bash
npm run db:push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
QuiverDM/
├── docs/                    # Project documentation
├── prisma/                  # Database schema
├── public/                  # Static assets
├── src/
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   ├── lib/                # Utility functions
│   ├── server/             # Server-side code (tRPC, etc.)
│   └── styles/             # Global styles
├── .env.example            # Environment variables template
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Contributing

This is a private project currently in development.

## License

Private - All Rights Reserved

## Contact

DevVentari - [@DevVentari](https://github.com/DevVentari)

