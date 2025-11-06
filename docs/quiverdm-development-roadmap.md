# QuiverDM - Development Roadmap with Claude Code

## ✅ Documentation Complete

1. **Product Requirements** ✓
   - Core features defined
   - User stories with acceptance criteria
   - MVP scope clearly outlined

2. **Design System** ✓
   - Stitch-ready prompts for all screens
   - Dark theme with purple accent (#8B5CF6)
   - Mobile-first responsive design

3. **Technical Architecture** ✓
   - Tech stack decided (Next.js + PostgreSQL + tRPC)
   - Database schemas planned
   - API structure defined

4. **Extended Features** ✓
   - Audio/video transcription system
   - Homebrew PDF library
   - AI-powered corrections

---

## 📝 Pre-Development Checklist

### Before Starting with Claude Code:

#### 1. **Environment Setup** (30 minutes)
```bash
# Create these files in your project root:

# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-secret-here"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
R2_ENDPOINT=""
R2_ACCESS_KEY=""
R2_SECRET_KEY=""
OPENAI_API_KEY=""

# .env.development
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### 2. **Project Initialization Commands**
```bash
# Let Claude Code run these:
npx create-next-app@latest quiverdm --typescript --tailwind --app
cd quiverdm
npm install @prisma/client prisma
npm install @trpc/server @trpc/client @trpc/next @trpc/react-query
npm install @tanstack/react-query
npm install next-auth @auth/prisma-adapter
npm install zustand dexie workbox-window
npm install react-hook-form @hookform/resolvers zod
npm install @radix-ui/themes
npm install framer-motion react-intersection-observer
```

#### 3. **Docker Setup for Local Dev**
Save this as `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: quiverdm
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: quiverdm
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## 🚀 Development Phases with Claude Code

### Phase 1: Foundation (Week 1)
**Goal**: Basic app structure with auth and campaigns

#### Day 1-2: Project Setup
```
Claude Code Tasks:
1. Initialize Next.js project with TypeScript
2. Setup Prisma with initial schema
3. Configure NextAuth with Google provider
4. Create base layout with dark theme
5. Setup tRPC boilerplate
```

#### Day 3-4: Campaign Management
```
Claude Code Tasks:
1. Create Campaign model and CRUD operations
2. Build Campaign dashboard UI
3. Implement campaign creation flow
4. Add campaign switching logic
5. Setup basic navigation structure
```

#### Day 5-7: Session Management
```
Claude Code Tasks:
1. Create Session model with relationships
2. Build session list view
3. Implement "Start Session" functionality
4. Create quick notes capture UI
5. Add session timer component
```

### Phase 2: Core Features (Week 2)
**Goal**: NPC system and note-taking

#### Day 8-10: NPC Management
```
Claude Code Tasks:
1. Create NPC model with full fields
2. Build NPC card grid component
3. Implement NPC search with instant results
4. Create NPC detail view
5. Add faction/relationship system
```

#### Day 11-12: Note System
```
Claude Code Tasks:
1. Enhance quick note capture
2. Build session recap editor
3. Implement auto-tagging for NPCs
4. Create rich text editing
5. Add glossary term detection
```

#### Day 13-14: Search & Navigation
```
Claude Code Tasks:
1. Implement global search
2. Build search results UI
3. Add filters and sorting
4. Create breadcrumb navigation
5. Implement quick actions menu
```

### Phase 3: Advanced Features (Week 3)
**Goal**: Transcription and homebrew system

#### Day 15-17: File Upload System
```
Claude Code Tasks:
1. Setup file upload with Cloudflare R2
2. Create upload UI with progress
3. Implement file type validation
4. Build processing queue system
5. Add file management interface
```

#### Day 18-19: Transcription Pipeline
```
Claude Code Tasks:
1. Integrate Whisper API
2. Build transcript editor UI
3. Implement glossary corrections
4. Create format generators (Discord/Table/Web)
5. Add speaker identification UI
```

#### Day 20-21: Homebrew Library
```
Claude Code Tasks:
1. Create PDF processing pipeline
2. Build homebrew categorization
3. Implement content search
4. Create homebrew detail views
5. Add quick-add to session feature
```

### Phase 4: Polish & Deploy (Week 4)
**Goal**: PWA features and production deployment

#### Day 22-23: PWA Implementation
```
Claude Code Tasks:
1. Configure service worker
2. Implement offline mode
3. Add install prompt
4. Setup push notifications
5. Create sync queue for offline changes
```

#### Day 24-25: Performance Optimization
```
Claude Code Tasks:
1. Implement code splitting
2. Add image optimization
3. Setup lazy loading
4. Configure caching strategies
5. Optimize database queries
```

#### Day 26-28: Deployment
```
Claude Code Tasks:
1. Setup Vercel deployment
2. Configure production database
3. Setup monitoring (Sentry)
4. Implement analytics
5. Create documentation
```

---

## 💻 Claude Code Prompts to Get Started

### Initial Setup Prompt:
```
Create a Next.js 14 app with TypeScript, Tailwind CSS, and app router. 
Setup Prisma with PostgreSQL. Create these models:
- User (id, email, name, image, accounts, sessions, campaigns)
- Campaign (id, name, description, banner, status, userId, createdAt, updatedAt)
- Session (id, campaignId, number, date, quickNotes, recap, status)
- NPC (id, campaignId, name, description, faction, secrets, imageUrl)

Setup NextAuth with Google provider and Prisma adapter.
Create a dark theme with #8B5CF6 as primary color.
Make the app mobile-first responsive.
```

### Campaign Dashboard Prompt:
```
Create a campaign dashboard that shows:
1. Campaign selector dropdown at top
2. Hero section with campaign banner and stats
3. Grid of 4 quick action cards: Sessions, NPCs, Players, Timeline
4. Floating action button for "Start Session"
5. Use dark theme with purple accents
6. Make it work perfectly on mobile
```

### Quick Notes Feature Prompt:
```
Build a quick notes system for active D&D sessions:
1. Floating action button that opens note input
2. Support both text and voice input
3. Auto-save every change
4. Show timestamp for each note
5. Allow tagging NPCs with @ symbol
6. Store notes locally first, then sync
7. Show sync status indicator
```

---

## 🎯 Success Criteria for MVP

### Technical Milestones
- [ ] PWA installable on mobile
- [ ] Offline mode fully functional
- [ ] <3 second search results
- [ ] <2 second page loads
- [ ] 100% mobile responsive

### Feature Completeness
- [ ] Campaign CRUD ✓
- [ ] Session management ✓
- [ ] Quick notes during play ✓
- [ ] NPC tracking ✓
- [ ] Basic search ✓
- [ ] Session recaps ✓
- [ ] Player tracking ✓

### Quality Metrics
- [ ] Lighthouse score >90
- [ ] Zero critical bugs
- [ ] <5% error rate
- [ ] Works offline
- [ ] Syncs reliably

---

## 🔧 Troubleshooting with Claude Code

### Common Issues to Watch For:

1. **Prisma Schema Changes**
   ```bash
   npx prisma migrate dev --name migration_name
   npx prisma generate
   ```

2. **tRPC Type Errors**
   ```bash
   # Restart TS server in VS Code
   Cmd+Shift+P > TypeScript: Restart TS Server
   ```

3. **PWA Not Installing**
   - Check manifest.json is valid
   - Ensure HTTPS in production
   - Service worker must be registered

4. **Offline Sync Issues**
   - Check IndexedDB storage
   - Verify service worker caching
   - Test with Chrome DevTools offline

---

## 📚 Resources for Claude Code

### Documentation Links
- [Next.js 14 App Router](https://nextjs.org/docs/app)
- [Prisma with Next.js](https://www.prisma.io/nextjs)
- [tRPC with Next.js](https://trpc.io/docs/nextjs)
- [NextAuth.js](https://next-auth.js.org/)
- [PWA with Next.js](https://github.com/shadowwalker/next-pwa)

### Design Resources
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Radix UI Themes](https://www.radix-ui.com/themes)
- [D&D 5e Database](https://www.dnd5eapi.co/)

---

## 🚦 Ready to Start!

You now have everything needed to begin development with Claude Code:

1. ✅ Complete product requirements
2. ✅ Design system and UI prompts  
3. ✅ Technical architecture decided
4. ✅ Database schema planned
5. ✅ Development roadmap clear
6. ✅ Initial prompts ready

**Next Step**: Start with the "Initial Setup Prompt" above and let Claude Code create your project foundation!

---

*Remember: Keep sessions focused on single features. Claude Code works best with clear, specific tasks rather than broad requests.*
