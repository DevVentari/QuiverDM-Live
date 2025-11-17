# QuiverDM Setup Checklist

Complete this checklist to get QuiverDM running locally.

## ✅ Step 1: Project Setup

- [x] Clone repository
- [x] Install dependencies (`npm install`)
- [x] Docker services running (PostgreSQL, Redis, MeiliSearch)

## 📝 Step 2: Get API Keys (30-45 minutes)

Follow the detailed guide: [`docs/API_KEYS_SETUP_GUIDE.md`](./docs/API_KEYS_SETUP_GUIDE.md)

### Essential Keys (Required for MVP):

- [ ] **NextAuth Secret**
  - [ ] Generate with: `openssl rand -base64 32`
  - [ ] Add to `.env.local`

- [ ] **Supabase** (Database + Auth)
  - [ ] Create account: https://supabase.com/dashboard/sign-up
  - [ ] Create project
  - [ ] Get Database URL
  - [ ] Get API keys (anon + service_role)
  - [ ] Add to `.env.local`

- [ ] **Google OAuth** (User Login)
  - [ ] Create project: https://console.cloud.google.com/
  - [ ] Set up OAuth consent screen
  - [ ] Create OAuth client ID
  - [ ] Add redirect URI: `http://localhost:3000/api/auth/callback/google`
  - [ ] Add credentials to `.env.local`

- [ ] **OpenAI API** (Whisper Transcription)
  - [ ] Create account: https://platform.openai.com/signup
  - [ ] Add payment method
  - [ ] Create API key: https://platform.openai.com/api-keys
  - [ ] Add to `.env.local`

- [ ] **Anthropic Claude API** (AI Summaries)
  - [ ] Create account: https://console.anthropic.com/
  - [ ] Add payment method
  - [ ] Create API key
  - [ ] Add to `.env.local`

- [ ] **Cloudflare R2** (File Storage)
  - [ ] Create account: https://dash.cloudflare.com/sign-up
  - [ ] Create R2 bucket: `quiverdm-media-dev`
  - [ ] Generate API token
  - [ ] Add credentials to `.env.local`

### Optional Keys (Can Add Later):

- [ ] Upstash (Redis/Queue)
- [ ] Sentry (Error Tracking)
- [ ] PostHog (Analytics)
- [ ] Discord OAuth
- [ ] Resend (Email)

## 🔧 Step 3: Configure Environment

```bash
# Copy template to .env.local
cp .env.local.template .env.local

# Edit .env.local with your API keys
# Use your favorite editor (VS Code, nano, notepad, etc.)
code .env.local
```

**Minimum required variables:**
```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=quiverdm-media-dev
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 🗄️ Step 4: Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Optional: Open Prisma Studio to view database
npm run db:studio
```

**Verify:**
- [ ] Prisma Client generated successfully
- [ ] Database schema created in Supabase
- [ ] Can open Prisma Studio at http://localhost:5555

## 🚀 Step 5: Start Development Server

```bash
# Start Next.js dev server
npm run dev
```

**Verify:**
- [ ] Server running at http://localhost:3000
- [ ] No console errors
- [ ] Can see the landing page
- [ ] Hot reload working

## 🧪 Step 6: Test Core Features

### Test Authentication:
- [ ] Click "Sign in" (when implemented)
- [ ] Google OAuth redirects properly
- [ ] Can authenticate successfully

### Test Database:
- [ ] Open Prisma Studio: `npm run db:studio`
- [ ] Verify tables exist (User, Campaign, Session, etc.)
- [ ] Create test data if needed

### Test Docker Services:
```bash
# Check Docker services are running
docker-compose ps

# Should show:
# quiverdm-postgres    (healthy)
# quiverdm-redis       (healthy)
# quiverdm-meilisearch (running)
```

## 📦 Step 7: Install Development Tools (Optional)

### VS Code Extensions:
- [ ] Prisma (Prisma.prisma)
- [ ] Tailwind CSS IntelliSense
- [ ] ESLint
- [ ] Prettier

### Browser Extensions:
- [ ] React Developer Tools
- [ ] Redux DevTools (if using)
- [ ] Supabase Extension

## 🔐 Step 8: Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] Never committed API keys to git
- [ ] Billing alerts set up on paid services
- [ ] Test keys separate from production keys

## 📚 Step 9: Read Documentation

- [ ] Review project structure in `README.md`
- [ ] Read tech stack decisions in `docs/quiverdm-tech-stack.md`
- [ ] Understand features in `docs/quiverdm-extended-features.md`
- [ ] Check development roadmap in `docs/quiverdm-development-roadmap.md`

## 🎯 Step 10: Ready to Code!

You're all set! Here are some next steps:

**Start Development:**
- [ ] Pick a task from `docs/quiverdm-development-roadmap.md`
- [ ] Create a new branch: `git checkout -b feature/your-feature`
- [ ] Start coding!

**Common Commands:**
```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema changes
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript check
npm test                 # Run tests (when added)

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs      # View logs
docker-compose ps        # Check status
```

## 🆘 Troubleshooting

### Port Already in Use:
```bash
# Find and kill process on port 3000 (Next.js)
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Database Connection Failed:
- [ ] Check Supabase project isn't paused
- [ ] Verify DATABASE_URL is correct
- [ ] Check password has no special characters causing issues
- [ ] Try resetting database password in Supabase

### Docker Services Won't Start:
```bash
# Clean restart
docker-compose down
docker-compose up -d

# View logs
docker-compose logs -f
```

### npm Install Errors:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 📞 Getting Help

- **Documentation:** Check `/docs` folder
- **API Keys Guide:** `docs/API_KEYS_SETUP_GUIDE.md`
- **GitHub Issues:** Report bugs and request features
- **Community:** Discord (if applicable)

---

**Estimated Total Setup Time:** 1-2 hours (including API key signup and configuration)

**Ready to start building?** Jump to `docs/quiverdm-development-roadmap.md` for your first task!
