# Campaign Banner Image — Design

**Goal:** Replace the clashing purple placeholder on campaign cards, add banner image upload, and show the image as a subtle vignette strip inside the campaign layout.

**Architecture:** Reuse the existing npc-image upload route pattern. `bannerUrl` already exists on the Campaign model and is accepted by `campaigns.update`. No schema changes needed.

**Tech Stack:** Next.js App Router, tRPC, R2/local storage (existing upload pattern), Tailwind CSS

---

## Part 1 — Placeholder replacement

Replace `bg-gradient-to-r from-purple-950 to-blue-950` on campaign cards (`campaigns/page.tsx:51`) with:

```
bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900
```

Dark neutral with faint amber warmth — consistent with the amber accent design system.

## Part 2 — Upload in Campaign Settings

Add a banner image section at the top of the Campaign Settings form (`campaigns/[slug]/settings/page.tsx`). DM-only (already gated by `isDM`). On file select, POST to `/api/upload/campaign-banner`, save returned URL via `campaigns.update({ id, bannerUrl })`. Show current image as 160px tall preview if set.

New route: `src/app/api/upload/campaign-banner/route.ts` — identical to `npc-image/route.ts`, key prefix `campaign-banners`.

## Part 3 — Vignette strip in campaign layout

In `campaigns/[slug]/layout.tsx`, wrap the header area with `relative`. If `bannerUrl` exists, render an absolutely positioned div with:
- `<Image fill object-cover>` filtered with `blur-[20px] opacity-[0.15] scale-110` (scale prevents blur edge bleed)
- A bottom gradient overlay: `bg-gradient-to-b from-transparent to-background`
- Header content (`h1`, description, role badge) stays at `relative z-10`

No image below the nav — content pages are completely unaffected.

## Files

| Action | File |
|--------|------|
| Create | `src/app/api/upload/campaign-banner/route.ts` |
| Modify | `src/app/(app)/campaigns/page.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/layout.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/settings/page.tsx` |
