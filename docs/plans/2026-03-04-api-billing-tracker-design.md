# API Billing Tracker — Design

**Date:** 2026-03-04
**Status:** Planned (not started)

## Goal
Standalone tool that aggregates spend across ALL projects (QuiverDM, Websites, SmartDrifter, nerdt infra) into a single dashboard. Eliminates checking 12+ provider dashboards.

## Architecture
- **Data collection:** n8n workflows on LXC 402 poll each provider's billing/usage API on a daily cron
- **Storage:** PostgreSQL on LXC 603 (new `api_billing` database)
- **Frontend:** Simple web UI (served from LXC 402 or as a static page behind Caddy)

## Services to Track

### QuiverDM
| Service | Billing Model | Has API? |
|---------|--------------|----------|
| Neon (Postgres) | Monthly plan | Yes — Neon API |
| Upstash (Redis) | Free tier / usage | Yes — Upstash API |
| Vercel (Hosting) | Monthly plan | Yes — Vercel API |
| Cloudflare R2 (Storage) | Per-GB | Yes — CF API |
| AssemblyAI (Transcription) | Per-minute | TBD — check docs |
| Google Gemini (AI) | Free tier / per-token | TBD |
| OpenAI (AI + DALL-E) | Per-token / per-image | Yes — /dashboard/billing/usage |
| Anthropic (AI) | Per-token | Yes — /usage API |
| Replicate (Image Gen) | Per-second GPU | Yes — /predictions billing |
| Stripe (Billing) | Per-transaction % | Yes — /v1/invoices |
| Resend (Email) | Free tier / per-email | TBD |
| PostHog (Analytics) | Free tier | Yes — org API |

### Websites (invoicely / metatagz / palettai)
| Service | Billing Model |
|---------|--------------|
| Supabase | Free tier | Yes — management API |
| Stripe (live) | Per-transaction % |
| Vercel | Shared with QuiverDM project |

### nerdt Server
| Service | Notes |
|---------|-------|
| Electricity / hardware | Manual entry |
| Domain renewals | Manual entry (Cloudflare) |

## n8n Workflow Design
1. **Schedule trigger** — daily at 6am AEST
2. **Parallel HTTP nodes** — one per provider API
3. **Transform + aggregate** — normalize to `{ provider, project, metric, value, cost_usd, date }`
4. **Postgres insert** — append to `daily_usage` table
5. **Optional Discord alert** — if any service exceeds threshold

## Database Schema (LXC 603)
```sql
CREATE TABLE daily_usage (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  provider TEXT NOT NULL,       -- 'openai', 'vercel', 'neon', etc.
  project TEXT NOT NULL,        -- 'quiverdm', 'websites', 'infra'
  metric TEXT NOT NULL,         -- 'cost_usd', 'requests', 'storage_gb', etc.
  value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_daily_usage_date ON daily_usage(date);
CREATE INDEX idx_daily_usage_provider ON daily_usage(provider, date);
```

## Frontend
Simple dashboard page showing:
- Total monthly spend (all projects)
- Per-project breakdown
- Per-provider sparkline charts (30-day trend)
- Alerts for services approaching limits

## Open Questions
- Which providers actually have billing APIs vs. just usage APIs (need to verify each)
- Auth tokens needed for each provider (most are in credentials.env already)
- Whether to build frontend as a standalone page or embed in n8n

## Next Steps
1. Research each provider's billing API availability and endpoints
2. Set up Postgres database on LXC 603
3. Build n8n workflows (one per provider)
4. Build simple web dashboard
