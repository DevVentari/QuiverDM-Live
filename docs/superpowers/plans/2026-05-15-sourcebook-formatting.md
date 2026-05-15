# Sourcebook Formatting Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 formatting defects in the sourcebook chapter reader — prose width, heading hierarchy, image DOM order, tables, blockquotes, list style, inline heading styles, and image captions.

**Architecture:** Frontend-only. Three files change: `src/styles/tokens.css` (CSS), `src/components/sourcebook/ChapterView.tsx` (rendering), `src/components/sourcebook/markdown-with-entities.tsx` (markdown overrides). No schema or API changes.

**Tech Stack:** Next.js 15, React, Tailwind CSS, ReactMarkdown + remarkGfm, TypeScript

**Design spec:** `docs/plans/2026-05-15-sourcebook-formatting-design.md`

---

### Task 1: prose-q CSS — heading hierarchy + list fix + illustration bleed

**Files:**
- Modify: `src/styles/tokens.css` (lines 254–266, the `.prose-q` block)

- [ ] **Step 1: Add h2/h3/h4 styles and fix ol, add illustration-full bleed**

Open `src/styles/tokens.css`. The current `.prose-q` block ends at line 266. Replace the existing block with the following (keep the variable block above it unchanged):

```css
.prose-q p { margin-block: 0.9rem; line-height: 1.7; }
.prose-q ul { margin-block: 0.9rem; padding-left: 1.4rem; list-style: disc; }
.prose-q ol { margin-block: 0.9rem; padding-left: 1.4rem; list-style: decimal; }
.prose-q li { margin-block: 0.3rem; }

.prose-q h2 {
  font-family: var(--q-font-display);
  font-size: 1.35rem;
  margin-top: 2.25rem;
  margin-bottom: 0.5rem;
  color: var(--q-text);
  letter-spacing: 0.02em;
}
.prose-q h3 {
  font-family: var(--q-font-display);
  font-size: 1.1rem;
  margin-top: 1.75rem;
  margin-bottom: 0.4rem;
  color: var(--q-text);
  letter-spacing: 0.01em;
}
.prose-q h4 {
  font-family: var(--q-font-display);
  font-size: 0.875rem;
  margin-top: 1.4rem;
  margin-bottom: 0.3rem;
  color: var(--q-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.prose-q blockquote {
  margin-block: 1.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--q-accent-primary-border);
  border-bottom: 1px solid var(--q-accent-primary-border);
  border-left: none;
  border-right: none;
  background: oklch(0.18 0.01 55 / 0.4);
  font-style: italic;
  color: var(--q-text);
  border-radius: 2px;
}

.prose-q table { width: 100%; border-collapse: collapse; margin-block: 1.25rem; font-size: 0.875rem; }
.prose-q thead th {
  background: var(--q-surface-utility);
  font-family: var(--q-font-display);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 2px solid var(--q-accent-primary-border);
}
.prose-q tbody tr:nth-child(even) { background: oklch(1 0 0 / 0.025); }
.prose-q tbody td { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--q-border-subtle); vertical-align: top; color: var(--q-text); }

/* Maps and scene images break out of the 72ch prose column */
.prose-q .illustration-full {
  width: calc(100% + 4rem);
  margin-left: -2rem;
  margin-right: -2rem;
  max-width: none;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (CSS change, TS unaffected — this step just keeps CI happy for later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "style(sourcebook): heading hierarchy, ol decimal, blockquote box, table styles, illustration-full bleed"
```

---

### Task 2: ChapterView — max-width + heading level rendering

**Files:**
- Modify: `src/components/sourcebook/ChapterView.tsx`

Current state of the section heading in `ChapterView.tsx` (around line 147):
```tsx
{section.heading && (
  <h2 className="mb-3 mt-8 font-display text-xl text-[var(--q-text)]">
    {section.heading}
  </h2>
)}
```

And the article wrapper (line 124):
```tsx
<article className="prose-q">
```

- [ ] **Step 1: Add heading level helper + update article max-width**

Replace the article opening tag at line 124:
```tsx
// OLD
<article className="prose-q">

// NEW
<article className="prose-q mx-auto max-w-[72ch]">
```

Add a helper function just above the `ChapterView` component declaration (before `export function ChapterView`):

```tsx
function sectionHeadingTag(level: number): 'h2' | 'h3' | 'h4' {
  if (level <= 1) return 'h2';
  if (level === 2) return 'h3';
  return 'h4';
}
```

- [ ] **Step 2: Use the heading tag helper in the section render**

In the `data.sections.map` block, find the heading render (currently always `<h2>`). Replace it so it uses the correct tag:

```tsx
// OLD
{section.heading && (
  <h2 className="mb-3 mt-8 font-display text-xl text-[var(--q-text)]">
    {section.heading}
  </h2>
)}

// NEW
{section.heading && (() => {
  const Tag = sectionHeadingTag(section.level);
  return <Tag className="font-display text-[var(--q-text)]">{section.heading}</Tag>;
})()}
```

The sizing comes from `prose-q h2/h3/h4` CSS rules added in Task 1 — do not add inline size classes here.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/sourcebook/ChapterView.tsx
git commit -m "feat(sourcebook): prose max-width 72ch, heading level hierarchy from section.level"
```

---

### Task 3: ChapterView — fix portrait image DOM order + illustration-full class + figcaption

**Files:**
- Modify: `src/components/sourcebook/ChapterView.tsx`

**Context:** Portrait images currently render *after* `<MarkdownWithEntities>`, so their `float-right` has no text to float beside. They need to be rendered *before* the markdown. Non-portrait images (maps, scenes) stay after. Maps and scenes get `className="illustration-full ..."` so they break out of the 72ch column.

- [ ] **Step 1: Split section images into portrait vs non-portrait in the render loop**

In the section `map` callback (inside `data.sections.map`), find where `sectionImages` is used. Replace the current single-pass image render with this pattern:

```tsx
const key = (section.heading ?? '').trim().toLowerCase();
const sectionImages = illustrationsBySection.get(key) ?? [];
const portraitImgs = sectionImages.filter(img => img.kind === 'portrait');
const wideImgs = sectionImages.filter(img => img.kind !== 'portrait');
```

Then in the JSX, render portraits *before* `<MarkdownWithEntities>` and wide images *after*:

```tsx
<section key={`${section.heading ?? 'intro'}-${index}`} className="mt-6">
  {section.heading && (() => {
    const Tag = sectionHeadingTag(section.level);
    return <Tag className="font-display text-[var(--q-text)]">{section.heading}</Tag>;
  })()}

  {/* Portrait images float beside the text — must precede the markdown in DOM */}
  {portraitImgs.map((illustration) => (
    <figure key={illustration.id} className="float-right ml-6 mb-4 w-[220px] clear-right">
      <button type="button" onClick={() => setZoom(illustration)} className="block w-full">
        <Image
          src={illustration.url}
          alt={illustration.alt ?? ''}
          width={440}
          height={600}
          className="w-full rounded-sm"
          unoptimized
        />
      </button>
      {illustration.alt && (
        <figcaption className="mt-1 text-center text-xs italic text-[var(--q-text-dim)]">
          {illustration.alt}
        </figcaption>
      )}
    </figure>
  ))}

  <div className="text-[var(--q-text)]">
    <MarkdownWithEntities
      markdown={section.markdown}
      entityById={entityById}
      campaignSlug={campaignSlug}
    />
  </div>

  {/* Maps and scene images go full-bleed after the text */}
  {wideImgs.map((illustration) => (
    <figure key={illustration.id} className="mt-6 clear-both">
      <button type="button" onClick={() => setZoom(illustration)} className="block w-full">
        <Image
          src={illustration.url}
          alt={illustration.alt ?? ''}
          width={1200}
          height={800}
          className={`illustration-full rounded-sm ${illustration.kind === 'map' ? 'my-4' : 'my-6'}`}
          unoptimized
        />
      </button>
      {illustration.alt && (
        <figcaption className="mt-1 text-center text-xs italic text-[var(--q-text-dim)]">
          {illustration.alt}
        </figcaption>
      )}
    </figure>
  ))}
</section>
```

Also remove the now-unused `illustrationClass` helper function (the one that returns `float-right ml-6 mb-4 w-[280px] rounded-sm` etc.) since we've inlined the logic.

Also add `clear-both` after the sections list to prevent the float from bleeding into the next section's content. Add `className="clear-both"` to a `<div>` after the `data.sections.map(...)` call.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sourcebook/ChapterView.tsx
git commit -m "fix(sourcebook): portrait images before markdown for correct float, figcaption, map bleed class"
```

---

### Task 4: MarkdownWithEntities — table overflow wrapper

**Files:**
- Modify: `src/components/sourcebook/markdown-with-entities.tsx`

**Context:** `remarkGfm` already parses markdown tables. The rendered `<table>` just needs an `overflow-x: auto` wrapper so wide tables scroll horizontally on small screens instead of breaking layout.

- [ ] **Step 1: Add table component override**

In `MarkdownWithEntities`, find the `components` object passed to `<ReactMarkdown>`. Add a `table` entry:

```tsx
table: ({ children }) => (
  <div className="overflow-x-auto my-4">
    <table>{children}</table>
  </div>
),
```

The full `components` object should now look like:

```tsx
components={{
  p: ({ children }) => <p>{renderChildren(children, entityById, campaignSlug)}</p>,
  li: ({ children }) => <li>{renderChildren(children, entityById, campaignSlug)}</li>,
  td: ({ children }) => <td>{renderChildren(children, entityById, campaignSlug)}</td>,
  th: ({ children }) => <th>{renderChildren(children, entityById, campaignSlug)}</th>,
  em: ({ children }) => <em>{renderChildren(children, entityById, campaignSlug)}</em>,
  strong: ({ children }) => <strong>{renderChildren(children, entityById, campaignSlug)}</strong>,
  blockquote: ({ children }) => <blockquote>{renderChildren(children, entityById, campaignSlug)}</blockquote>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table>{children}</table>
    </div>
  ),
}}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sourcebook/markdown-with-entities.tsx
git commit -m "feat(sourcebook): table overflow-x wrapper for mobile scrolling"
```

---

### Task 5: Visual verification

**Files:** None changed — verification only.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Navigate to: `http://localhost:3847/campaigns/curse-of-strahd/sourcebook?chapter=into-the-mists`

- [ ] **Step 2: Check prose width**

At 1440px viewport, the chapter text should be visibly narrower than the card. Lines should feel readable — approximately 65–72 characters wide. The card background should be visible on both sides of the text column.

- [ ] **Step 3: Check heading hierarchy**

Navigate to `?chapter=the-lands-of-barovia`. The top-level section headings should be larger and heavier than any sub-section headings. Look for sections with `level: 2` — they should render noticeably smaller than `level: 1` headings.

- [ ] **Step 4: Check portrait image float**

On `the-lands-of-barovia` or `into-the-mists`, portrait illustrations should appear beside the section text (floating right), with text wrapping around the left side. The portrait should NOT appear below the paragraph it belongs to.

- [ ] **Step 5: Check blockquote**

Find a chapter with read-aloud boxed text (any major location chapter). The blockquote should appear as a box with top+bottom amber borders and a slightly warm background — not a left-border-only style.

- [ ] **Step 6: Check ordered list**

Navigate to `?chapter=appendix-a-character-options`. Any numbered lists should use `1. 2. 3.` numerals, not bullet points.

- [ ] **Step 7: Push**

```bash
git push origin main
```

---

## Success Criteria

- [ ] Lines in the prose content area are ≤ 72ch wide at 1440px viewport
- [ ] Sub-section headings (`level: 2`) are visibly smaller than top-level (`level: 1`)
- [ ] Portrait images float beside text, not below it
- [ ] Tables have alternating row backgrounds and scroll on mobile
- [ ] Blockquote reads as a distinct pull-out box (top/bottom borders, warm background)
- [ ] Ordered lists use `1.` `2.` not bullet points
- [ ] Images with non-empty `alt` show a caption below
