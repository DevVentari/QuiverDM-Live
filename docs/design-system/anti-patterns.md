# Anti-Patterns

Things to avoid when building QuiverDM UI.

## No generic "AI slop" aesthetic

Avoid the default AI-generated look: overly smooth gradients, stock-photo hero sections, generic SaaS layouts with rounded-everything and pastel accents. QuiverDM should feel like a D&D tool, not a productivity app template.

## No bright white backgrounds

Dark mode is the default and primary experience. Never use `bg-white`, `bg-gray-50`, or any light background as a base. Even light-mode values exist only as fallbacks. Cards use semi-transparent `glass-panel` surfaces, never opaque white.

## No flat, single-color cards

Cards must have visual depth. Always use `glass-panel` (translucent background + backdrop blur + subtle border) rather than a solid `bg-card` fill. Combine with `glass-grain` for noise texture on important surfaces. Hover states should shift border opacity, not background color.

**Bad**: `<Card className="bg-zinc-900 border-zinc-800">`
**Good**: `<Card className="glass-panel hover:border-foreground/50 transition-colors">`

## No cookie-cutter layouts

Avoid uniform grids of identically-sized cards. Use asymmetry intentionally: the dashboard mixes a hero section, horizontal scroll carousel, and vertical card lists. CreatePageShell uses a 38/62 split, not 50/50. Negative space is a tool -- not every pixel needs content.

## No purple gradients on white

This is a D&D dungeon tool, not a startup landing page. The purple in the palette is deep indigo (`hsl(258 40% 12%)`) used for subtle atmospheric glows, never as a bright accent on light surfaces. Amber/gold is the primary accent color.

## Research before building

Before implementing any new UI pattern, check how these products handle it:
- **Baldur's Gate 3** -- character sheets, inventory, stat presentations
- **D&D Beyond** -- monster stat blocks, spell cards, encounter layouts
- **Roll20** -- initiative trackers, map overlays, chat panels

Match the atmospheric depth of these products. QuiverDM should feel like opening an ancient tome in a candlelit room.
