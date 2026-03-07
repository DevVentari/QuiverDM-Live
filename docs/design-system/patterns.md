# Patterns

## CreatePageShell

Split layout for creation forms. Defined in `src/components/create/create-page-shell.tsx`.

- **Props**: `overline` (label-overline text), `title` (font-display heading), `preview` (left/top), `children` (form right/bottom)
- **Desktop**: preview sticky at 38% width left, form fills remaining right
- **Mobile**: stacked vertically (preview on top, form below)

```
+---label-overline---+
| HEADING (Cinzel)   |
+--------+-----------+
| Preview|  Form     |   <- lg:flex-row
| (38%)  |  (flex-1) |
|        |           |
+--------+-----------+
```

## glass-panel + glass-grain

The standard card treatment. Apply `glass-panel` to any `<Card>` for the translucent dark surface with blur. Add `glass-grain` for a subtle noise texture overlay.

```tsx
<Card className="glass-panel glass-grain">
  <CardContent>...</CardContent>
</Card>
```

- Sidebar uses `glass-shell glass-grain` (slightly different opacity + stronger blur)
- Interactive cards add `hover:border-foreground/50 transition-colors cursor-pointer`

## section-rule

Amber gradient divider. Apply the class to an empty `<div>` between sections.

```tsx
<p className="label-overline mb-1">Campaigns</p>
<div className="section-rule" />
```

Renders a 1px horizontal line fading from amber (left) to transparent (right), with 0.5rem bottom margin.

## label-overline

Small uppercase section label in muted amber. Used above section-rule dividers and in CreatePageShell headings.

- 0.625rem / 500 weight / 0.25em letter-spacing / uppercase
- Color: `hsl(35 80% 55% / 0.4)`

## Campaign Card

Banner image + gradient fallback + stats footer. Used on dashboard (`src/app/(app)/dashboard/page.tsx:185`).

```
+---------------------------+
| Banner (h-28, object-cover)|  <- or gradient fallback
+---------------------------+
| Title          [Role Badge]|
| Description (line-clamp-1) |
| 3 sessions  5 members     |  <- text-[11px] text-muted-foreground
+---------------------------+
```

- Fallback gradient: `bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900`
- Card uses `glass-panel h-full overflow-hidden`
- Stats row uses inline `<span>` elements separated by gap-3

## Collapsible Stat Block

Expandable detail sections for monster/NPC stat blocks. See `src/components/encounter/stat-block-card.tsx`.

- Toggle between compact (collapsed) and expanded views
- Chevron icon rotates on toggle (`ChevronDown` / `ChevronRight`)
- Ability scores displayed in a 6-column grid with label/score/modifier stack
- Sections (saves, skills, senses, actions) conditionally rendered when expanded
- Uses local `useState` for expand/collapse -- no external state management
