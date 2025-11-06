# QuiverDM Web MVP - Stitch-Ready Design Prompts

## === FOUNDATION ===

"Web-based D&D session management platform for Dungeon Masters to upload recordings, generate AI summaries, and manage homebrew content. Professional and efficient, mystical undertones. 
Primary color: #8B5CF6 (vibrant purple). Dark background #0F0F0F with subtle noise texture. 
12px corner radius on cards, 8px on buttons. Inter font for UI, Merriweather for content display."

## === SCREEN 1: Dashboard ===

"Dashboard layout: Fixed sidebar navigation on left (240px) with dark purple gradient. Main content area shows welcome message with user name in heading. Three stat cards in row: Sessions Processed, Total Campaigns, Homebrew Items - each with large number and purple accent border. Recent Sessions section below with horizontal scroll of session cards showing campaign name, date, processing status badge. Large 'Upload New Session' button floating in bottom right with upload icon, purple gradient background."

## === SCREEN 2: Session Upload ===

"Upload screen: Centered modal overlay on dark backdrop. Large dashed border drop zone (600x400px) with upload cloud icon, 'Drop audio/video files here or click to browse' text. Supported formats listed below (MP3, WAV, M4A, MP4, MOV). After file selected: shows file preview with waveform visualization, file size, estimated processing time. Form fields below: Campaign dropdown selector, Session number (auto-increment), Date picker, Optional title. Process button at bottom with loading spinner when active."

## === SCREEN 3: Processing Queue ===

"Processing Queue: Full-width table layout with alternating row colors. Columns: File Name, Campaign, Upload Time, Status, Progress, Actions. Status badges: Queued (gray), Processing (animated purple), Complete (green), Failed (red). Progress shown as percentage bar with purple fill. Processing items show animated pulse effect. Completed items have 'View Transcript' button. Failed items show retry button and error message tooltip. Auto-refresh every 5 seconds with subtle update animation."

## === SCREEN 4: Transcript Viewer ===

"Transcript viewer: Two-column layout. Left column (70%): Transcript with timestamps in left margin [HH:MM:SS format], speaker labels in bold purple, text in readable Merriweather font. Sticky toolbar at top with Edit mode toggle, Search within transcript, Export options dropdown. Right column (30%): Session metadata card, Speaker management (assign names, merge speakers), Quick actions (Generate Summary, Apply Glossary, Download). Timestamps are clickable for audio playback if available."

## === SCREEN 5: Summary Generator ===

"Summary Generator: Three-tab interface (Discord, Reddit, Document). Each tab shows preview of generated format. Discord tab: Emoji-rich text in Discord markdown preview box, character count indicator, Copy button. Reddit tab: 'Previously on...' narrative style in Reddit post preview. Document tab: Structured sections with headers - Key Events, NPCs Encountered, Combat Summary, Loot & Rewards, Next Session Seeds. Bottom action bar with Regenerate button (dice icon), Copy to Clipboard, Export as PDF, Share to Discord (webhook integration)."

## === SCREEN 6: Homebrew Library ===

"Homebrew Library: Top action bar with 'Upload PDF' button, search bar, filter dropdown (All, Items, Creatures, Spells). Grid layout of content cards (3 columns desktop). Each card: Type icon in top corner, Title in bold, Source PDF reference, Preview text (2 lines), Tag chips for categories. Hover state shows Edit and Delete buttons. Click opens detail modal. Upload area appears as slide-out panel from right with drag-drop zone, processing status, extracted content preview before saving."

## === SCREEN 7: Homebrew Detail Modal ===

"Homebrew Detail: Large modal (80% screen width). Header with type badge and title, edit button. Content in markdown editor when in edit mode, rendered view otherwise. For creatures: Stat block in official 5e style with parchment texture background. For items: Properties list, rarity badge with color coding. For spells: Level and school badges, components icons, full description. Images displayed inline if extracted from PDF. Bottom toolbar: Save Changes, Cancel, Delete (red), Add to Campaign button."

## === SCREEN 8: Campaign Management ===

"Campaign Management: Card grid layout (2 columns). Each campaign card: Hero banner image or gradient, campaign title in serif font, player count and session count badges, Last played date, settings gear icon. New Campaign card with dashed border and large plus icon. Click card to enter campaign. Campaign detail view: Tabs for Overview, Sessions, Glossary, NPCs, Homebrew. Glossary tab shows term management with auto-complete suggestions, pronunciation guides, term variations."

## === SCREEN 9: Search Results ===

"Search Results: Instant search dropdown below search bar in header. Results grouped by type with section headers (Sessions, NPCs, Homebrew, Campaigns). Each result: Type icon, primary text with search term highlighted in purple, context snippet, campaign badge. Empty state: Crystal ball illustration with 'No prophecies found' message. Advanced search link opens modal with filters: Date range, Campaign, Content type, Tags."

## === SCREEN 10: User Settings ===

"Settings page: Vertical tabs on left (Profile, API Keys, Preferences, Billing). Profile tab: Avatar upload, display name, email, password change. API Keys tab: Masked keys with copy buttons, usage stats, regenerate option. Preferences: Processing options (Whisper model selection), Summary preferences (tone, length), Notification settings. Billing tab: Current plan card, usage metrics with progress bars, upgrade button, invoice history table."

## === IMAGE-SPECIFIC PROMPTS FOR WEB MVP ===

"On Dashboard, hero section background: Subtle animated gradient mesh in purples and deep blues, suggesting magical energy flowing."

"On Upload screen, file type icons: Hand-drawn style icons for audio (waveform), video (play button), PDF (document), all with purple gradient fills."

"On Processing Queue, status animations: Processing status shows rotating D20 die with purple glow effect, pulsing gently."

"On Transcript Viewer, speaker avatars: Geometric shapes - hexagon for DM (purple), circles for players (different colors), all with subtle gradient fills."

"On Homebrew Library, placeholder image: Mystical spell book with purple glow, partially open with visible magical text."

## === LOADING & EMPTY STATES ===

"Loading states: Skeleton screens with purple shimmer animation moving left to right. D20 die spinner for longer operations."

"Empty states: Friendly illustrations with helpful text. Empty dashboard: 'Begin your adventure - Upload your first session'. Empty search: 'The crystal ball reveals nothing'. Empty homebrew: 'Your tome awaits - Upload your first PDF'."

## === INTERACTION PATTERNS ===

"Hover effects: Cards lift with subtle shadow, 2px purple border fades in. Buttons darken 10% on hover, scale 0.98 on click."

"Notifications: Toast notifications slide in from top-right, auto-dismiss after 5 seconds. Success (green), Error (red), Info (purple), Warning (amber)."

"Modals: Dark overlay with 50% opacity, modal slides up with subtle bounce animation. Close with X button or clicking outside."

"Progress indicators: Purple gradient progress bars, percentage text updates smoothly. Long operations show estimated time remaining."

"Tooltips: Dark background with purple border, appear on hover after 500ms delay, positioned to avoid viewport edges."

## === RESPONSIVE BREAKPOINTS ===

"Desktop (1440px+): Full sidebar, 3-column grids, side-by-side layouts, all features visible."

"Laptop (1024-1439px): Collapsible sidebar, 2-column grids, stacked layouts for some sections."

"Tablet (768-1023px): Hamburger menu, single column with cards, simplified navigation, touch-optimized buttons."

"Mobile (< 768px): Bottom navigation, single column, simplified features, upload via native file picker only."

## === NAVIGATION STRUCTURE ===

"Sidebar navigation: Logo at top, user avatar and name below. Navigation sections: Dashboard (home icon), Sessions (microphone icon), Campaigns (castle icon), Homebrew (book icon), Settings (gear icon). Active item highlighted with purple background, white text. Collapse button at bottom for more space."

"Top header: Search bar center, notification bell right, user menu dropdown far right. Breadcrumbs below for deep navigation."

## === COLOR PALETTE ===

"Primary Purple: #8B5CF6 (buttons, links, accents)"
"Purple Hover: #7C3AED (darker for hover states)"  
"Purple Light: #A78BFA (badges, highlights)"
"Background Dark: #0F0F0F (main background)"
"Surface Dark: #1A1A1A (cards, panels)"
"Surface Elevated: #262626 (modals, dropdowns)"
"Text Primary: #FFFFFF (main content)"
"Text Secondary: #A1A1AA (supporting text)"
"Text Muted: #71717A (timestamps, metadata)"
"Success Green: #22C55E"
"Error Red: #EF4444"
"Warning Amber: #F59E0B"

## === TYPOGRAPHY ===

"Headings: Inter font - 32px (h1), 24px (h2), 20px (h3), 16px (h4)"
"Body text: Inter 14px regular for UI, Merriweather 16px for content"
"Small text: Inter 12px for metadata, labels"
"Code/mono: 'Fira Code' or 'JetBrains Mono' for IDs, technical info"
"Line height: 1.5 for body text, 1.2 for headings"

## === FORM ELEMENTS ===

"Input fields: Dark background #262626, 1px border #404040, purple border on focus, 8px padding, 8px radius."

"Dropdowns: Same styling as inputs, chevron icon right, dropdown menu with shadow, hover highlights in purple."

"Buttons: Primary (purple gradient), Secondary (purple outline), Tertiary (text only). All with 8px radius, 12px horizontal padding."

"Checkboxes/Radios: Custom styled with purple accent when checked, smooth transition animations."

"File upload: Dashed border area, drag state shows purple glow, file preview with progress bar during upload."

## === ACCESSIBILITY ===

"Focus indicators: 2px purple outline with 2px offset, visible on keyboard navigation only."

"ARIA labels: All interactive elements have descriptive labels, live regions for dynamic content updates."

"Contrast ratios: All text meets WCAG AA standards, important actions meet AAA."

"Keyboard navigation: Tab order logical, skip links available, all actions keyboard accessible."

"Screen reader: Semantic HTML, proper heading hierarchy, alt text for images, status announcements."
