# Sourcebook Ingest Runbook

End-to-end workflow for pulling a new D&D Beyond sourcebook into QuiverDM's master content store, **prioritising accuracy via Ollama-based review over speed**. Time is not a constraint here — every entity that lands in `SourcebookEntity` and `HomebrewContent` is downstream truth for every campaign that links to the book, so we accept slow + correct over fast + wrong.

## 0. Prereqs

- DM account on dev (`blake.wales.au@gmail.com`) with a valid `CobaltSession` stored in `UserSettings.dndBeyondCobaltCookie` (use the browser extension or `npm run ddb:login`).
- Ollama running locally (`localhost:11434`) with `qwen2.5:14b` or larger pulled. We use it as the review LLM, not for extraction (which uses the configured AI provider chain). A bigger local model is fine — review pass is once per book.
- Postgres + Redis pointed at homelab via `.env` (no `.env.local` — workers won't see it).
- Pre-flight: confirm sourcebook is **owned** in DDB (`prisma.ddbEntitlement` row exists). The sync coordinator filters non-owned books.

## 1. Trigger the sync

```bash
# Via the admin UI:
# https://dev.quiverdm.com/admin/rules-sources → "Sync from D&D Beyond" → pick book

# Or via tRPC from a script:
npx tsx scripts/ddb-trigger-sync.ts <sourcebook-slug>
```

The coordinator enqueues:
1. `ddb-sync-coordinator` — fetches sourcebook metadata, creates `DdbSourcebook` + chapters
2. `ddb-chapter-extract` — per chapter: HTML fetch, image upsert, AI section extraction
3. `ddb-sync-review` — final QA pass (writes `SourcebookSyncReview`)

Watch progress: `pm2 logs worker-ddb-coordinator` on LXC 206.

## 2. Dry-run first (optional but recommended for new books)

```bash
npx tsx scripts/ddb-dry-run.ts <sourcebook-slug> > docs/Test/ddb/<slug>.json
```

This runs the full extraction pipeline but writes to a JSON file instead of the DB. Inspect the output before letting the real sync run.

## 3. Per-chapter Ollama review (the slow, correct step)

Once the sync finishes, **do not link the sourcebook to any user campaign yet**. Run the review loop:

```bash
npx tsx scripts/ddb-review-with-ollama.ts <sourcebook-slug>
```

This script (write if it doesn't exist yet — pattern below):

1. Pulls every `SourcebookEntity` row from the new book.
2. For each entity, fetches the raw chapter section it was extracted from (`DdbSourcebookChapter.content` slice by `sourceSpan`).
3. Asks Ollama (system prompt: "You are a careful D&D 5e content reviewer; flag any extraction errors, hallucinated stats, or missing information") to compare extracted vs raw.
4. Writes JSON output to `docs/Test/ddb/<slug>-review.jsonl` with one line per entity:
   ```json
   { "id": "...", "name": "...", "kind": "monster", "verdict": "ok" | "fix" | "drop", "notes": "..." }
   ```
5. Logs a summary: ok/fix/drop counts per kind.

Throughput target: ~3-5 entities/sec on RTX 3090 with qwen2.5:14b. For LMoP (~150 entities) plan on 30-60 min. Fine.

### Triage the review output

```bash
jq 'select(.verdict == "fix")' docs/Test/ddb/<slug>-review.jsonl | less
jq 'select(.verdict == "drop")' docs/Test/ddb/<slug>-review.jsonl | less
```

For each `fix`:
- Open Prisma Studio → `SourcebookEntity` → edit by id
- Re-run a single entity through extraction if the fix is structural (`npx tsx scripts/ddb-extract-one.ts <entity-id>`)

For each `drop`:
- `delete` the `SourcebookEntity` row (cascades from `HomebrewContent` clone)
- Note in the review file with `--applied` suffix

## 4. Image audit

The chapter extractor stores every `<img>` it finds in `SourcebookChapterImage`. After extraction:

```bash
# Visual gallery
npx tsx scripts/ddb-image-gallery.ts <sourcebook-slug> > /tmp/gallery.html && open /tmp/gallery.html
```

Confirm:
- Monsters have portraits (auto-linked via `statBlockId` → creature.imageUrl from `/monsters/<id>` scrape)
- Locations have maps (kind=`map`)
- NPCs have portraits when available (heuristic match; many DDB books don't include them)

Missing images? Run `npx tsx scripts/backfill-chapter-illustrations.ts <slug>` to re-fetch, or `scripts/ddb-magic-item-images.ts <slug>` for item-page scrapes.

## 5. Promote to "verified"

Once the review is clean:

```sql
UPDATE "DdbSourcebook"
SET "syncStatus" = 'verified', "verifiedAt" = NOW()
WHERE slug = '<slug>';
```

This is the gate for campaign linking. Only verified sourcebooks appear in the campaign-create sheet picker.

## 6. Link to a verification campaign and smoke-test

```bash
# Create or pick a throwaway campaign owned by you
# Link via UI: /campaigns/<slug>/settings → Sourcebooks → Link → pick book
```

The link triggers `cloneSourcebookEntitiesIntoCampaign` which copies `SourcebookEntity` → `WorldEntity` (per campaign). Verify:
- Compendium "In Campaign" toggle shows the new content
- NPCs page shows DDB NPCs (union with regular NPC table)
- Locations show on the world tab
- Magic items appear in compendium with images
- Spot-check 5 random monsters: stat blocks match the book

## 7. Memory note

After a successful sync + verification, add a one-liner to `memory/MEMORY.md` under **Completed Features** with: book slug, date, entity counts, image coverage %, any quirks. The full review JSONL stays in `docs/Test/ddb/` for audit history.

---

## Why Ollama, not the bigger cloud LLMs

- **Air-gapped review**: extraction can be cloud, review must be local. Cheaper to iterate, no quota concerns when re-running on 150+ entities.
- **Cost asymmetry**: extraction is one-shot per chapter; review is potentially many passes. Local Ollama makes it free to be paranoid.
- **Privacy**: DDB book content is licensed material; keeping the review loop on local hardware avoids sending entire chapters to third parties beyond the primary extractor.

## Why slow is fine

A bad `SourcebookEntity` row poisons every campaign that links the book forever. Catching a wrong CR or missing trait at ingest is one DB edit; catching it after 12 campaigns have cloned it is 12 edits and a confused user every time. The cost curve favours pre-link rigour. Aim for **zero `fix` items unreviewed** before flipping `syncStatus` to `verified`.
