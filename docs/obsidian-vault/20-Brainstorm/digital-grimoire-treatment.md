# QuiverDM UI/UX Brainstorming & Templates

This folder contains UI templates and design experiments for the QuiverDM application.

## 1. Aesthetic North Star: "The Digital Grimoire"
The goal is to evolve the current "Stone UI" into a more tactile, "Digital Grimoire" experience. It should feel like a physical artifact that is magically reactive.

### Key Principles
- **Tactility:** Surfaces should have texture (grain, fiber, stone).
- **Depth:** Use inner shadows and multi-layered borders to create "etched" or "carved" effects.
- **Luminescence:** Interactive elements should "glow" or "breathe" rather than just change color.
- **Imperfection:** Subtle asymmetries, chipped corners, and "hand-drawn" accents.

## 2. Proposed Components & Templates

### A. Enhanced Stone Card (`StoneCardEnhanced`)
- **Features:** 
  - SVG-masked "chipped" corners.
  - Inner shadow to simulate a carved inset.
  - Hover state: Grain opacity increases + subtle "amber bleed" from the edges.
  - Decorative "runic" corner accents.

### B. Parchment & Scrolls (`ParchmentSheet`)
- **Purpose:** Contrast for notes, NPC letters, or "official" documents.
- **Features:**
  - Warm, paper-like colors (`oklch` tints of yellow/orange).
  - Ragged edges (SVG mask).
  - Subtle fiber texture.
  - Typewriter or Script typography (via `Bricolage` or similar).

### C. Magical Dividers (`EtchedSeparator`)
- **Features:**
  - Gradient lines that fade out.
  - A central "rune" or "gemstone" icon.
  - Glowing animation on mount.

### D. Gemstone Buttons (`GemButton`)
- **Features:**
  - High-gloss, "jewel" like appearance.
  - Inner refraction effect using multiple gradients.
  - Pulse animation when active.

## 3. UI/UX Refinements

### Micro-Interactions
- **Page Transitions:** Staggered "reveal" using Framer Motion (like ink spreading on paper).
- **Tooltips:** "Floating" runes that appear near the cursor.
- **Loading:** A "scrying" or "crystal ball" animation.

### Navigation
- **Sidebar:** More "physical" feel—maybe a wooden panel or a stack of books.
- **Active States:** Instead of just a background color, use a "lit" effect (like a candle placed next to the menu item).

---

## Template Registry
- `StoneCardEnhanced.tsx` (Planned)
- `ParchmentSheet.tsx` (Planned)
- `EtchedSeparator.tsx` (Planned)
