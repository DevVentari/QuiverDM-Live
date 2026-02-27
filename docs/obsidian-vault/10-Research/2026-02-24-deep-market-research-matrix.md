# Deep Market Research Matrix (Comprehensive)

Date: 2026-02-24

## Objective

Build decision-grade market intelligence for go/no-go, positioning, pricing, and growth allocation.

## Research Tracks

1. TAM/SAM/SOM by segment
- DMs by frequency: weekly, biweekly, monthly.
- Systems split: D&D 5e, PF2e, CoC, VtM, others.
- Deliverable: bottom-up market model with confidence ranges.

2. Segment jobs-to-be-done (JTBD)
- DM prep, in-session control, post-session continuity.
- Deliverable: ranked pain map by frequency x severity x willingness-to-pay.

3. Competitor teardown (workflow-level)
- Roll20, Foundry, D&D Beyond, LegendKeeper, World Anvil, Alchemy, Obsidian workflows.
- Deliverable: workflow comparison matrix and white-space map.

4. Feature demand + willingness-to-pay
- Van Westendorp + feature-bundle tests.
- Deliverable: demand curve and feature-gated pricing package recommendations.

5. Retention driver analysis
- Identify actions most correlated with week-4 and week-8 retention.
- Deliverable: activation and retention causal hypotheses.

6. Channel economics
- Reddit, Discord, creator partnerships, SEO, referrals.
- Deliverable: CAC/LTV by channel and scaling thresholds.

7. Conversion funnel diagnostics
- Signup -> first session -> first recap -> repeat use -> paid.
- Deliverable: funnel leak report with prioritized fixes.

8. COGS and unit economics
- Per workflow cost (transcription, recap, search, image).
- Deliverable: gross margin envelope and cap policy.

9. Legal/compliance risk
- User-uploaded content boundaries, retention policy, AI disclosure language.
- Deliverable: feature risk register (green/yellow/red).

10. Integration value validation (Foundry sidecar)
- Measure whether Foundry-linked users activate and pay at higher rates.
- Deliverable: integration ROI decision.

11. Geographic and language expansion signal
- Demand outside US English, timezone/session behavior, support load.
- Deliverable: expansion readiness score.

12. Enterprise/B2B wedge
- Stores, pro DMs, clubs, publisher partnerships.
- Deliverable: B2B pilot criteria and pricing hypotheses.

## Method Stack

1. Qualitative:
- 40-60 interviews (DM-heavy) with structured coding.

2. Quantitative:
- Funnel telemetry, cohort retention, usage clustering.

3. Experimentation:
- Landing page and onboarding tests.
- Price/package smoke tests.

4. Desk research:
- Quarterly refresh of competitor and market shifts.

## Decision Gates

Gate 1 (30 days):
- validated pain hierarchy
- initial channel fit

Gate 2 (60 days):
- willingness-to-pay clarity
- retention driver confidence

Gate 3 (90 days):
- clear path to break-even with known scale channel

## Evidence Quality Standard

Feature claims are "integration-eligible" only if backed by:

1. 3+ user-evidence points
2. 2+ market/competitor references
3. economics estimate
4. measurable success criteria

## Artifacts to maintain

1. `docs/obsidian-vault/_machine/feature_registry.json`
2. `docs/obsidian-vault/_machine/decision_log.jsonl`
3. Segment-level interview notes in `10-Research`
4. Integration shortlist in `30-Integration-Candidates`

