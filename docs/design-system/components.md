# Components

All UI primitives live in `src/components/ui/` and are shadcn/ui installations.

## Inventory

| Component | File | Primary Use |
|-----------|------|-------------|
| Accordion | `accordion.tsx` | Collapsible FAQ sections, expandable detail panels |
| Alert Dialog | `alert-dialog.tsx` | Destructive confirmations (delete campaign, remove member) |
| Avatar | `avatar.tsx` | User/player avatars in nav, member lists |
| Badge | `badge.tsx` | Role tags, status indicators, content type labels |
| Button | `button.tsx` | Primary CTAs, form submits, icon actions |
| Card | `card.tsx` | Campaign cards, stat panels, dashboard sections |
| Circular Progress | `circular-progress.tsx` | Upload/processing progress indicators |
| Command | `command.tsx` | Command palette, search dialogs (cmdk-based) |
| Dialog | `dialog.tsx` | Modal forms (create NPC, invite player, feedback) |
| Dropdown Menu | `dropdown-menu.tsx` | Context menus, action menus on cards |
| Form | `form.tsx` | react-hook-form integration wrapper |
| Input | `input.tsx` | Text inputs across all forms |
| Label | `label.tsx` | Form field labels |
| Progress | `progress.tsx` | Linear progress bars (PDF processing, uploads) |
| Scroll Area | `scroll-area.tsx` | Custom scrollable containers (sidebar, long lists) |
| Select | `select.tsx` | Dropdowns for campaign role, content type filters |
| Separator | `separator.tsx` | Visual dividers between sections |
| Sheet | `sheet.tsx` | Mobile sidebar, slide-out panels |
| Skeleton | `skeleton.tsx` | Loading placeholders for cards, lists |
| Sonner | `sonner.tsx` | Toast notifications (success, error, info) |
| Switch | `switch.tsx` | Toggle settings (notifications, features) |
| Table | `table.tsx` | Data tables (members, sessions, homebrew lists) |
| Tabs | `tabs.tsx` | Content switching (character sheets, session views) |
| Textarea | `textarea.tsx` | Multi-line input (session notes, descriptions) |
| Tooltip | `tooltip.tsx` | Hover hints on icon buttons, truncated text |

## Notes

- `circular-progress.tsx` is a custom component (not from shadcn registry).
- `sonner.tsx` wraps the Sonner toast library with theme integration.
- Cards are almost always combined with `glass-panel` class for the translucent dark surface.
- Badge renders as a `<div>` with `capitalize` class (relevant for test selectors).
