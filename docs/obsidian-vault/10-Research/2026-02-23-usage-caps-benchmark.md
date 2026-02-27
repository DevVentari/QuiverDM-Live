# Usage Caps Benchmark (Early-Stage SaaS)

Date checked: 2026-02-23

## External benchmark notes

1. Otter free tier has a monthly transcription-minute cap and stricter per-conversation limits.
2. Fireflies free plan limits transcription credits/storage and increases limits in paid tiers.
3. D&D Beyond and other TTRPG tools reinforce low-mid monthly price tolerance for hobby users.

Implication:

- Free must be enough to experience core value at least once.
- Paid tiers should align with recurring DM behavior (2-8 sessions/month).
- Hard limits + soft throttles are required to control AI COGS.

## Recommended early caps (v1)

### Option A (recommended for 90-day validation)

- Free:
  - Campaigns: `1`
  - Transcription: `120 min/mo`
  - Session uploads: `4/mo`
  - AI recaps: `4/mo`
  - PDF uploads: `3/mo`
  - Semantic searches: `50/mo`
  - Image generations: `5/mo`
- Pro (`$9`):
  - Campaigns: `unlimited`
  - Transcription: `1,200 min/mo`
  - Session uploads: `30/mo`
  - AI recaps: `30/mo`
  - PDF uploads: `40/mo`
  - Semantic searches: `1,000/mo`
  - Image generations: `80/mo`
- Team (`$19`):
  - Campaigns: `unlimited`
  - Transcription: `3,600 min/mo`
  - Session uploads: `100/mo`
  - AI recaps: `120/mo`
  - PDF uploads: `150/mo`
  - Semantic searches: `4,000/mo`
  - Image generations: `300/mo`

### Guardrails

1. Per-session max transcription ingest: `240 minutes`.
2. Burst guard: max 2 concurrent heavy jobs per user.
3. Quality fallback: downgrade expensive model automatically on quota pressure.
4. Overages disabled in first 90 days; force upgrade or next-cycle reset.

## Economics guard

Set target:

- Gross margin floor: `>=70%` on Pro/Team.

Evaluation:

- If variable COGS per paid user exceeds `30%` of ARPU for 2 consecutive weeks:
  - tighten recap/image/search caps first
  - keep transcription cap stable (core value)

## Integration with current code

Current limits are defined in:

- `src/server/services/usage.service.ts`

Action:

- Expand from 3 limit families (campaigns, transcription, pdfs) to full limit object including recap/search/image.

## Sources

- Otter pricing: https://otter.ai/pricing
- Fireflies pricing: https://fireflies.ai/pricing
- D&D Beyond subscriptions: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747225116820-Subscriptions-Pricing
- LegendKeeper pricing: https://www.legendkeeper.com/pricing/

