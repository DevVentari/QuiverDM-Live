# QuiverDM - Tech Stack & Architecture Decisions

## Executive Architecture Decision

**Approach**: Progressive Web App (PWA) with offline-first architecture
**Reasoning**: 
- Single codebase for iOS/Android/Web
- Works seamlessly at the gaming table (offline capability)
- No app store approval delays for updates
- Lower development cost than native apps

---

## Frontend Stack

### Core Framework: **Next.js 14 with App Router**
```javascript
// Key advantages:
- Server Components for initial load performance
- Built-in API routes for backend
- Excellent PWA support via next-pwa
- Image optimization out of the box
- Streaming SSR for large transcripts
```

### UI Library: **Tailwind CSS + shadcn/ui**
```javascript
// Component structure:
- Tailwind for utility-first styling (dark mode built-in)
- shadcn/ui for accessible component primitives
- Framer Motion for gestures and animations
- React Hook Form for complex forms
- Zustand for state management (lighter than Redux)
```

### Mobile-First Libraries
```javascript
dependencies: {
  "react-swipeable": "^7.0.0",        // Swipe gestures
  "react-intersection-observer": "^9.5.0", // Infinite scroll
  "pwa-asset-generator": "^6.0.0",    // PWA icons
  "workbox": "^7.0.0",                // Offline caching
  "dexie": "^3.2.0",                  // IndexedDB wrapper
}
```

---

## Backend Stack

### API Framework: **Next.js API Routes + tRPC**
```typescript
// Type-safe API calls
const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({ url: '/api/trpc' }),
        wsLink({ url: '/api/ws' })  // Real-time updates
      ]
    }
  }
});
```

### Database: **PostgreSQL with Prisma**
```prisma
// schema.prisma snippet
model Campaign {
  id        String   @id @default(cuid())
  name      String
  sessions  Session[]
  npcs      NPC[]
  glossary  Json     // JSONB for flexible structure
  @@index([userId])
}
```

### Real-time: **Redis + Socket.io**
```javascript
// For live session collaboration
- Redis pub/sub for message passing
- Socket.io for WebSocket fallback
- Presence tracking for active players
```

---

## AI & Processing Stack

### Transcription Service Architecture
```javascript
// Dual-mode approach
if (user.privacy_mode) {
  // Client-side using Transformers.js
  const { pipeline } = await import('@xenova/transformers');
  const transcriber = await pipeline('automatic-speech-recognition', 
    'Xenova/whisper-tiny.en');
} else {
  // Server-side using OpenAI
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json"  // Includes timestamps
  });
}
```

### PDF Processing Pipeline
```javascript
// Modular processing system
import { PDFExtract } from 'pdf-extract';        // Text extraction
import { createWorker } from 'tesseract.js';     // OCR for images
import { ChromaClient } from 'chromadb';         // Vector store
import { OpenAI } from 'openai';                 // Categorization

class HomebrewProcessor {
  async process(pdf) {
    const text = await this.extractText(pdf);
    const images = await this.extractImages(pdf);
    const structured = await this.categorizeContent(text);
    const vectors = await this.generateEmbeddings(structured);
    return { structured, vectors, images };
  }
}
```

### Search Infrastructure
```javascript
// Hybrid search approach
- MeiliSearch for typo-tolerant text search
- ChromaDB for semantic search
- PostgreSQL full-text search as fallback

// Implementation
const searchResults = await Promise.all([
  meiliSearch.index('npcs').search(query),
  chromaDB.collection('homebrew').query(embedding),
  prisma.$queryRaw`SELECT * FROM npcs WHERE to_tsvector(name || ' ' || description) @@ to_tsquery(${query})`
]);
```

---

## Storage Architecture

### Media Storage: **Cloudflare R2**
```javascript
// S3-compatible with egress-free pricing
const r2 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  }
});

// Storage structure
/campaigns/{campaignId}/
  /audio/{sessionId}/{timestamp}.webm
  /transcripts/{sessionId}/transcript.json
  /images/npcs/{npcId}/portrait.webp
  /homebrew/pdfs/{pdfId}/original.pdf
```

### Caching Strategy
```javascript
// Multi-tier caching
1. Browser Cache (Workbox)
   - Static assets: 1 year
   - API responses: 5 minutes
   
2. IndexedDB (Dexie)
   - Current campaign data
   - Recent NPCs
   - Active session notes
   
3. Redis (Server)
   - Session data
   - Search results
   - Glossary terms
   
4. CDN (Cloudflare)
   - Images
   - Processed PDFs
   - Audio files
```

---

## Development Environment

### Monorepo Structure
```
quiverdm/
├── apps/
│   ├── web/          # Next.js PWA
│   ├── processor/    # Background job processor
│   └── docs/         # Documentation site
├── packages/
│   ├── db/          # Prisma schema & client
│   ├── api/         # tRPC routers
│   ├── ui/          # Shared components
│   └── audio/       # Audio processing utilities
├── docker/
│   ├── postgres/
│   ├── redis/
│   └── meilisearch/
└── .github/
    └── workflows/   # CI/CD pipelines
```

### Local Development Stack
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: quiverdm
      
  redis:
    image: redis:7-alpine
    
  meilisearch:
    image: getmeili/meilisearch:v1.5
    
  minio:
    image: minio/minio  # Local S3 for development
    command: server /data --console-address ":9001"
```

---

## Deployment Architecture

### Hosting: **Vercel + Railway**
```javascript
// Vercel for Next.js app
- Automatic preview deployments
- Edge functions for API routes
- Image optimization
- Global CDN

// Railway for services
- PostgreSQL database
- Redis instance
- Background job processor
- WebSocket server
```

### Background Jobs: **BullMQ**
```javascript
// Job processing for heavy tasks
const transcriptionQueue = new Queue('transcription', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
});

// Worker
const worker = new Worker('transcription', async (job) => {
  const { audioUrl, campaignId } = job.data;
  const transcript = await processAudio(audioUrl);
  const corrected = await applyGlossary(transcript, campaignId);
  await generateFormats(corrected);
});
```

---

## Security Implementation

### Authentication: **NextAuth.js v5**
```javascript
// Multi-provider auth
export default NextAuth({
  providers: [
    GoogleProvider({ clientId, clientSecret }),
    AppleProvider({ clientId, clientSecret }),
    EmailProvider({ server, from })
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    session: async ({ session, token }) => {
      session.user.role = token.role;
      return session;
    }
  }
});
```

### API Security
```javascript
// Rate limiting
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});

// Row-level security in Prisma
const campaign = await prisma.campaign.findFirst({
  where: {
    id: campaignId,
    userId: session.user.id  // Automatic filtering
  }
});
```

---

## Performance Optimizations

### Bundle Optimization
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@tremor/react', 'lodash']
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1200, 1920],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'transformers': 'transformers/dist/transformers.min.js'
    };
    return config;
  }
};
```

### Database Optimization
```sql
-- Indexes for common queries
CREATE INDEX idx_npcs_campaign_name ON npcs(campaign_id, name);
CREATE INDEX idx_sessions_campaign_date ON sessions(campaign_id, created_at DESC);
CREATE INDEX idx_transcripts_search ON transcripts USING GIN(to_tsvector('english', corrected_text));

-- Materialized view for complex queries
CREATE MATERIALIZED VIEW campaign_stats AS
  SELECT campaign_id, 
         COUNT(DISTINCT sessions.id) as session_count,
         COUNT(DISTINCT npcs.id) as npc_count,
         MAX(sessions.created_at) as last_session
  FROM campaigns
  LEFT JOIN sessions ON campaigns.id = sessions.campaign_id
  LEFT JOIN npcs ON campaigns.id = npcs.campaign_id
  GROUP BY campaign_id;
```

---

## Monitoring & Analytics

### Application Monitoring: **Sentry + Vercel Analytics**
```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
});
```

### Custom Analytics
```javascript
// Using Mixpanel for product analytics
const analytics = {
  track: (event, properties) => {
    mixpanel.track(event, {
      ...properties,
      campaign_id: currentCampaign?.id,
      session_id: currentSession?.id,
      device_type: getDeviceType(),
    });
  }
};

// Key events to track
analytics.track('session_started', { method: 'quick_start' });
analytics.track('transcript_generated', { duration_seconds, word_count });
analytics.track('homebrew_imported', { pdf_size, content_count });
```

---

## Cost Projections (100 Active DMs)

### Monthly Infrastructure Costs
```
Vercel Pro:           $20
Railway (DB+Redis):   $20
Cloudflare R2:        $10 (storage)
OpenAI API:           $500 (transcription)
MeiliSearch Cloud:    $29
Monitoring:           $14 (Sentry)
------------------------
Total:               ~$593/month
```

### Self-Hosted Alternative
```
VPS (Hetzner):       $50
Backups:             $10
Monitoring:          $14
------------------------
Total:               ~$74/month
(Using local Whisper, no API costs)
```

---

## Migration Path

### From MVP to Scale
```javascript
// Phase 1: Serverless (0-1000 users)
- Vercel + Planetscale
- Cloudflare Workers for edge computing

// Phase 2: Hybrid (1000-10000 users)
- Add dedicated processor servers
- Redis cluster for caching
- Read replicas for database

// Phase 3: Self-hosted (10000+ users)
- Kubernetes cluster
- Self-hosted Whisper models
- Multi-region deployment
```

---

## Decision Summary

**Go with this stack for MVP:**
1. **Next.js 14** - Modern, fast, great DX
2. **PostgreSQL + Prisma** - Robust, type-safe
3. **Cloudflare R2** - Cheap storage
4. **OpenAI Whisper API** - Start simple, add local later
5. **Vercel + Railway** - Easy deployment
6. **tRPC** - Type-safe API without GraphQL complexity

**Defer these decisions:**
- Native mobile app (PWA first)
- Real-time collaboration (add in Phase 2)
- Self-hosted AI (start with APIs)
- Kubernetes (unnecessary for MVP)

This architecture can handle 10,000+ concurrent users with minimal changes, while keeping initial complexity and costs low.
