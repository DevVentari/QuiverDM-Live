# Typography

Type system specifications for QuiverDM, including font families, scale, and usage guidelines.

---

## Font Families

### Display Font: Cinzel

A classically-inspired serif typeface with a contemporary feel. Evokes ancient Roman inscriptions and medieval manuscripts.

| Property | Value |
|----------|-------|
| Family | `Cinzel` |
| Category | Serif / Display |
| Source | Google Fonts |
| Weights | 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold) |
| CSS Variable | `var(--font-display)` |

**Usage**: Headings, titles, campaign names, feature headings, hero text

**Character**: Authoritative, classical, fantasy-appropriate

### Body Font: Crimson Text

An elegant serif designed for book typography. Highly readable with a warm, literary character.

| Property | Value |
|----------|-------|
| Family | `Crimson Text` |
| Category | Serif |
| Source | Google Fonts |
| Weights | 400 (Regular), 600 (SemiBold) |
| CSS Variable | `var(--font-body)` |

**Usage**: Body text, paragraphs, UI labels, descriptions, form inputs

**Character**: Readable, warm, scholarly

---

## Font Loading

### Next.js Implementation

```typescript
// src/app/layout.tsx
import { Cinzel, Crimson_Text } from "next/font/google";

const fontDisplay = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const fontBody = Crimson_Text({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600"],
});
```

### Fallback Stacks

```css
--font-display: 'Cinzel', 'Times New Roman', 'Georgia', serif;
--font-body: 'Crimson Text', 'Georgia', 'Times New Roman', serif;
```

---

## Type Scale

Based on a 1.25 ratio (Major Third) with 16px base.

| Name | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| Display XL | 48px / 3rem | 1.1 | 700 | Hero headlines |
| Display L | 36px / 2.25rem | 1.15 | 700 | Page titles |
| H1 | 30px / 1.875rem | 1.2 | 700 | Section headers |
| H2 | 24px / 1.5rem | 1.25 | 600 | Subsection headers |
| H3 | 20px / 1.25rem | 1.3 | 600 | Card titles |
| H4 | 18px / 1.125rem | 1.35 | 600 | Minor headings |
| Body L | 18px / 1.125rem | 1.6 | 400 | Lead paragraphs |
| Body | 16px / 1rem | 1.6 | 400 | Default body text |
| Body S | 14px / 0.875rem | 1.5 | 400 | Secondary text |
| Caption | 12px / 0.75rem | 1.4 | 400 | Labels, metadata |
| Overline | 11px / 0.6875rem | 1.3 | 600 | Uppercase labels |

---

## Tailwind Classes

### Font Family

```html
<h1 class="font-display">Campaign Title</h1>
<p class="font-body">Body text content...</p>
```

### Tailwind Config

```typescript
// tailwind.config.ts
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}
```

---

## Heading Styles

### H1 - Page Titles

```css
.h1 {
  font-family: var(--font-display);
  font-size: 1.875rem; /* 30px */
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--color-text-primary);
}
```

### H2 - Section Headers

```css
.h2 {
  font-family: var(--font-display);
  font-size: 1.5rem; /* 24px */
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: var(--color-text-primary);
}
```

### H3 - Card Titles

```css
.h3 {
  font-family: var(--font-display);
  font-size: 1.25rem; /* 20px */
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}
```

---

## Body Text Styles

### Paragraph

```css
p {
  font-family: var(--font-body);
  font-size: 1rem; /* 16px */
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-text-primary);
}
```

### Lead Paragraph

```css
.lead {
  font-family: var(--font-body);
  font-size: 1.125rem; /* 18px */
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
```

### Caption

```css
.caption {
  font-family: var(--font-body);
  font-size: 0.75rem; /* 12px */
  font-weight: 400;
  line-height: 1.4;
  color: var(--color-text-secondary);
}
```

---

## Special Text Treatments

### Campaign Names

```css
.campaign-name {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: none;
}
```

### D&D Terms (Proper Nouns)

```css
.dnd-term {
  font-family: var(--font-display);
  font-weight: 500;
  font-style: normal;
}
```

### Dice Notation

```css
.dice-notation {
  font-family: ui-monospace, monospace;
  font-weight: 600;
  letter-spacing: 0.05em;
}
```

Example: `2d6 + 4`

---

## Responsive Typography

### Mobile (< 640px)

```css
/* Reduce display sizes on mobile */
.display-xl { font-size: 2.25rem; } /* 36px */
.display-l { font-size: 1.875rem; } /* 30px */
.h1 { font-size: 1.5rem; } /* 24px */
```

### Tablet (640px - 1024px)

```css
/* Moderate display sizes */
.display-xl { font-size: 2.75rem; }
.display-l { font-size: 2rem; }
```

### Desktop (> 1024px)

Use default type scale values.

---

## Best Practices

### Do

- Use Cinzel for all headings and feature text
- Use Crimson Text for all body content
- Maintain consistent line heights
- Use appropriate weights (don't use light weights)
- Allow generous line height for readability

### Don't

- Mix more than 2 font families
- Use font weights outside the loaded set
- Stretch or compress type
- Use very long line lengths (max 75 characters)
- Use pure white (#FFFFFF) text on dark backgrounds

---

## Accessibility

### Minimum Sizes

| Context | Minimum Size |
|---------|--------------|
| Body text | 16px |
| Interactive elements | 14px |
| Captions | 12px |
| Legal/fine print | 11px |

### Line Length

- **Optimal**: 50-75 characters per line
- **Maximum**: 85 characters per line
- Use container widths to control line length

### Contrast

Ensure all text meets WCAG AA contrast requirements:
- Normal text: 4.5:1 minimum
- Large text (18px+ or 14px+ bold): 3:1 minimum
