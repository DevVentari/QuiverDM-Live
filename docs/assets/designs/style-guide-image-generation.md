# QuiverDM — Image Generation Style Guide

**Style:** D&D 5e PHB illustration style for portraits — warm, painterly, heroic. BG3 concept art for locations. Isolated object renders for items.
**Not:** photorealistic, 3D render, anime, watercolour, stock art, purple-gradient AI slop.

## Style Anchors (approved reference images)

All three generated 2026-05-22 with `higgsfield nano_banana_2` at 2k. Use as `--image` references for style consistency.

| Type | File | Use when |
|------|------|----------|
| NPC Portrait | `style-anchor-npc-portrait.png` | Generating character/NPC portraits |
| Location | `style-anchor-location.png` | Generating scene/environment art |
| Item | `style-anchor-item.png` | Generating item/spell/artifact art |

---

## Prompt Templates

### NPC / Character Portrait

```
[DESCRIPTION: race, class, age, defining features, expression, pose, held item],
three-quarter bust portrait, dramatic warm rim lighting, D&D 5th edition Player's Handbook
illustration style, Tyler Jacobson fantasy art, warm painted portrait, heroic fantasy character
art, detailed face, rich warm amber and earthy tones, soft architectural background,
illustrated painterly not photographic, no text
```

- Aspect ratio: `3:4`
- Resolution: `2k`
- Reference image: `style-anchor-npc-portrait.png`

**Example:** `A scarred half-elf cleric, auburn braided hair, holy symbol around neck, resigned expression, three-quarter bust portrait, D&D 5th edition Player's Handbook illustration style, Tyler Jacobson fantasy art ...`

### Location / Scene

```
[DESCRIPTION: location type, architectural detail, lighting sources, mood, time of day],
BG3 Baldur's Gate 3 concept art style, digital painting, dark fantasy environment illustration,
atmospheric perspective, wide establishing shot, warm amber and cool blue contrast,
painterly, illustrated not photographic, no text
```

- Aspect ratio: `16:9`
- Resolution: `2k`
- Reference image: `style-anchor-location.png`

**Example:** `Ancient underground library, towering shelves of crumbling tomes, floating green-lit lanterns, a single shaft of moonlight from a collapsed ceiling, ...`

### Item / Artifact / Spell

```
[DESCRIPTION: item, material, magical effect — single object only],
isolated on pure black background, no props no surface no candle no cloth,
faint [amber | violet | blue] runic glow, dramatic top-down lighting,
BG3 Baldur's Gate 3 concept art style, dark fantasy item illustration,
digital painting, painterly close-up, illustrated not photographic, no text
```

- Aspect ratio: `1:1`
- Resolution: `2k`
- Reference image: `style-anchor-item.png`
- **Key rule:** single object only — never add candles, cloth, surfaces, or props

**Example:** `A silver ring set with a black opal, faint violet runes etched on the band, isolated on pure black background, no props ...`

---

## CLI Command Template

```bash
higgsfield generate create nano_banana_2 \
  --prompt "<subject description>, <core style suffix>" \
  --aspect_ratio <3:4 | 16:9 | 1:1> \
  --resolution 2k \
  --image "E:\Projects\QuiverDM\docs\assets\designs\style-anchor-npc-portrait.png" \
  --wait
```

Pass the matching anchor image (`--image`) to reinforce style consistency across generations.
For item art, use `style-anchor-item.png`. For locations, use `style-anchor-location.png`.

---

## Colour Palette Targets

Generated images should feel coherent with the app token palette:

| Role | App token | Image target |
|------|-----------|--------------|
| Primary warm | `--q-accent-primary` (amber) | Candlelight, runic glows, fire |
| Background deep | `--q-bg` (indigo-black) | Deep shadows, backgrounds |
| Accent cool | `--q-accent-arcane` (purple) | Magic auras, arcane effects, moonlight |
| Midtone | `--q-surface-feature` | Stone, leather, aged wood |

---

## What to avoid

- **Photorealistic** — looks wrong next to our illustrated UI
- **Bright backgrounds** — everything should live in shadow
- **Generic fantasy stock** — no parchment textures, generic dragons, medieval clip art
- **Anime / cartoon** — wrong register entirely
- **Purple gradient / glowing orb AI aesthetic** — that's startup landing page, not D&D
- **Text in image** — always include "no text" in prompt
