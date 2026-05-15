# Sourcebook Reader — Formatting Improvements Design

**Date:** 2026-05-15  
**Status:** Approved

## Problem

The sourcebook reader displays chapter text and images but has several formatting defects that make it significantly harder to read than DDB itself:

1. **No prose max-width** — text spans the full card width (~900px at 1440px viewport). Lines are unreadably long.
2. **Flat heading hierarchy** — all section headings render as `h2` regardless of `section.level`. Sub-sections are visually indistinguishable from top-level sections.
3. **Portrait images broken** — portrait images are styled `float-right` but render *after* the section markdown in the DOM. Floats only work when the element precedes the text it should wrap. Result: portraits appear below the text, not beside it.
4. **Tables unstyled for D&D** — minimal borders, no alternating rows, no `overflow-x: auto` wrapper (breaks on mobile).
5. **Blockquote / read-aloud text** — amber left border + italic only. D&D "read-aloud" boxes need a distinct, atmospheric treatment.
6. **Ordered lists use disc** — `prose-q` applies `list-style: disc` to both `ul` and `ol`.
7. **No inline markdown heading styles** — `h3`/`h4` rendered by ReactMarkdown inside section markdown have no custom styles in `prose-q`.
8. **No image captions** — `alt` text exists in the DB but nothing renders it below illustrations.

## Scope

Frontend-only changes. No schema changes, no new tRPC endpoints, no new data. All fixes are in:
- `src/styles/tokens.css` (prose-q class)
- `src/components/sourcebook/ChapterView.tsx`
- `src/components/sourcebook/markdown-with-entities.tsx`

## Design

### 1. Prose max-width

Wrap the `<article>` content in a max-width container:

```tsx
<article className="prose-q mx-auto max-w-[72ch]">
```

72ch (~700px) is the established readability sweet spot for long-form text. Wide elements (maps, scene illustrations) break out using negative margin:

```css
.prose-q .illustration-full {
  width: calc(100% + 4rem);
  margin-left: -2rem;
  margin-right: -2rem;
}
```

Maps and scene images (`kind === 'map' || kind === 'scene'`) get this class. Portrait images stay within the column (float-right at 220px width, not 280px).

### 2. Heading hierarchy

`ChapterView.tsx` currently always renders `<h2>` for section headings. Use `section.level` to pick the correct tag:

- `level === 1` → `<h2>` (top-level chapter section)
- `level === 2` → `<h3>`
- `level === 3+` → `<h4>`

Add matching styles to `prose-q`:

```css
.prose-q h2 { font-family: var(--q-font-display); font-size: 1.35rem; margin-top: 2rem; margin-bottom: 0.5rem; color: var(--q-text); letter-spacing: 0.02em; }
.prose-q h3 { font-family: var(--q-font-display); font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.35rem; color: var(--q-text); letter-spacing: 0.01em; }
.prose-q h4 { font-family: var(--q-font-display); font-size: 0.95rem; margin-top: 1.25rem; margin-bottom: 0.25rem; color: var(--q-text-dim); text-transform: uppercase; letter-spacing: 0.06em; }
```

ReactMarkdown headings inside section markdown (h3/h4 from `##`/`###`) inherit the same styles automatically.

### 3. Fix portrait image DOM order

In `ChapterView.tsx`, portrait images currently render after the markdown block. Move portrait images to render *before* `<MarkdownWithEntities>` so float-right wraps the text correctly:

```tsx
{portraitImages.map(img => <PortraitImage key={img.id} ... />)}
<MarkdownWithEntities ... />
{nonPortraitImages.map(img => <FullWidthImage key={img.id} ... />)}
```

Split `sectionImages` into `portraitImages` (kind === 'portrait') and `nonPortraitImages` (everything else) within the section render loop.

### 4. Tables

Wrap every `<table>` in an `overflow-x: auto` div via a ReactMarkdown custom component. Add alternating row backgrounds and tighten padding:

```css
.prose-q table { width: 100%; border-collapse: collapse; margin-block: 1.25rem; font-size: 0.875rem; }
.prose-q thead th { background: var(--q-surface-utility); font-family: var(--q-font-display); font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--q-accent-primary-border); }
.prose-q tbody tr:nth-child(even) { background: oklch(1 0 0 / 0.025); }
.prose-q tbody td { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--q-border-subtle); vertical-align: top; }
```

In `MarkdownWithEntities`, add a `table` component override:

```tsx
table: ({ children }) => (
  <div className="overflow-x-auto my-4">
    <table>{children}</table>
  </div>
),
```

### 5. Blockquote / read-aloud text

D&D read-aloud text is a distinct speech act (DM reading to players). Style it as a pull-out box:

```css
.prose-q blockquote {
  margin-block: 1.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--q-accent-primary-border);
  border-bottom: 1px solid var(--q-accent-primary-border);
  border-left: none;
  background: oklch(0.18 0.01 55 / 0.4);
  font-style: italic;
  color: var(--q-text);
  border-radius: 2px;
}
.prose-q blockquote p:first-child::before {
  content: '"';
  font-family: var(--q-font-display);
  font-size: 2rem;
  line-height: 0;
  vertical-align: -0.4em;
  margin-right: 0.15em;
  color: var(--q-accent-primary);
  opacity: 0.6;
}
```

### 6. Fix ol list-style

```css
.prose-q ul { list-style: disc; }
.prose-q ol { list-style: decimal; }
```

### 7. Image captions

Render `alt` text as a `<figcaption>` below each illustration (when non-empty and not equal to the chapter title):

```tsx
<figure>
  <Image ... />
  {illustration.alt && illustration.alt !== data.chapter.title && (
    <figcaption className="text-center text-xs text-[var(--q-text-dim)] mt-1 italic">
      {illustration.alt}
    </figcaption>
  )}
</figure>
```

## Files Changed

| File | Change |
|------|--------|
| `src/styles/tokens.css` | h2/h3/h4 styles, ol decimal, blockquote restyle, table styles, figure/figcaption |
| `src/components/sourcebook/ChapterView.tsx` | prose max-width, heading level switch, portrait-before-text DOM order, figcaption |
| `src/components/sourcebook/markdown-with-entities.tsx` | `table` wrapper component override |

## Non-goals

- No schema changes
- No new API calls
- No changes to the chapter tree sidebar
- No changes to the entity hover cards
- No changes to the image zoom dialog
- No stat block formatting (no stat blocks in CoS sourcebook data)

## Success Criteria

- At 1440px viewport, lines in the prose area are ≤ 72 characters wide
- Sub-sections (`level: 2`) render visibly smaller than top-level sections (`level: 1`)
- Portrait illustrations float beside their section text, not below it
- Tables have alternating row backgrounds and scroll horizontally on mobile
- Read-aloud blockquote blocks are visually distinct (box treatment, not just a border)
- Ordered lists use numerals, not bullets
- Images with non-generic alt text show a caption
