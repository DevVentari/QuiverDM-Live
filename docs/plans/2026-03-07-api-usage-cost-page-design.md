# API Usage & Cost Tracking Page — Design

**Date:** 2026-03-07
**Route:** `/settings/api-usage`
**Status:** Approved

## Goal

Show users how much of their AI provider quota they've consumed, what it's costing them, broken down by feature and model. Combines internal call logging with optional provider API sync.

## Data Model

### New Prisma model: `ApiUsageLog`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK -> User |
| provider | String | `gemini`, `openai`, `anthropic`, `ollama` |
| model | String | `gemini-2.0-flash`, `gpt-4o`, etc. |
| feature | String | `extraction`, `recap`, `search`, `image_gen`, `derailment`, `combat_copilot` |
| tokensIn | Int | Input tokens |
| tokensOut | Int | Output tokens |
| estimatedCost | Float | USD |
| requestCount | Int | Default 1, for batched ops |
| metadata | Json? | homebrewId, sessionId, etc. |
| createdAt | DateTime | |

**Indexes:** `(userId, createdAt)`, `(userId, provider, createdAt)`, `(userId, feature, createdAt)`

## Cost Estimation

Hardcoded cost-per-token map in `src/lib/ai/pricing.ts`:

| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|------------------|
| Gemini Flash | $0.075 | $0.30 |
| Gemini Pro | $1.25 | $5.00 |
| GPT-4o | $2.50 | $10.00 |
| Claude Sonnet | $3.00 | $15.00 |
| Ollama (local) | $0 | $0 |

Single source of truth. Updated as providers change pricing.

## Logging Integration

Wrap existing AI calls (extraction pipeline, summary worker, search embeddings, derailment detector, combat copilot) with a `logApiUsage()` call that writes to `ApiUsageLog` after each provider response. Token counts from provider response metadata.

**Touch points:**
- `src/lib/ai/` — extraction providers (Gemini, OpenAI, Anthropic)
- Summary worker
- Embeddings worker
- Derailment worker
- Combat copilot worker
- Search (semantic)

## Provider API Sync (Phase 2)

Optional "Sync from provider" button per provider:
- Gemini: Google AI Studio usage API
- OpenAI: `/v1/organization/usage` or dashboard billing API
- Anthropic: usage API (limited)

Additive — shows discrepancy if user also uses keys outside QuiverDM.

## Page Layout: `/settings/api-usage`

### Header: Provider Summary Cards
One card per configured key:
- Provider name + icon
- Total requests this period
- Total tokens (in/out)
- Estimated cost
- Gemini: remaining free requests (1000/day - today's count)

### Breakdown by Feature
Table: Feature | Requests | Tokens In | Tokens Out | Est. Cost
- Extraction, Recaps, Search, Image Gen, Derailment, Combat Copilot

### Breakdown by Model
Which models consumed what (same table format)

### Recent API Calls
Last 50 calls with timestamp, feature, model, tokens, cost

### Period Selector
Current period (matches billing period) with option to view previous periods

## tRPC Router

New `apiUsage` router (or extend `usage`):
- `getApiUsageSummary` — aggregated stats for current period
- `getApiUsageByFeature` — grouped by feature
- `getApiUsageByModel` — grouped by model
- `getRecentApiCalls` — paginated recent log (cursor-based, 50 per page)

## Navigation

- Link from Settings page near API Keys section: "View API Usage ->"
- No sidebar change (settings already present)

## Future: Cross-Project Billing Tracker

Standalone dashboard tracking API spend across all projects (QuiverDM, Websites, SmartDrifter, nerdt infra). Separate system — this design covers QuiverDM only.
