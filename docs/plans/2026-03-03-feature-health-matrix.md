# Feature Health Matrix — 2026-03-03

## Coverage Legend
- ✅ Active test — passes in CI
- ⚠️ UI only — verifies page loads, not functionality
- 🔧 Stubbed — test.fixme, not yet active
- ❌ No test — completely untested
- ❓ Unknown — needs investigation

---

## Authentication & Access

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Sign-in page loads | `tests/auth.spec.ts` | ✅ | Button visibility check |
| Sign-in with valid credentials | `tests/smoke/auth.smoke.spec.ts` | ✅ | Redirects into app shell |
| Sign-in rejects invalid credentials | `tests/smoke/auth-invalid.smoke.spec.ts`, `tests/auth.spec.ts` | ✅ | Inline error message asserted |
| Sign-up page loads | `tests/auth.spec.ts` | ✅ | Button visibility check |
| Protected routes redirect unauthenticated users | `tests/auth.spec.ts`, `tests/smoke/access-control.smoke.spec.ts` | ✅ | 4 protected routes checked |
| Password reset flow | — | ❌ | Router exists (`passwordReset`), no Playwright coverage |
| Onboarding wizard step indicators | `tests/onboarding.spec.ts` | ✅ | Conditional — skips if already completed |
| Onboarding completion redirects away | `tests/onboarding.spec.ts` | ✅ | URL pattern check |
| Onboarding loop prevention | — | ❌ | Bug was fixed (c97e712), no regression test |
| Beta invite code entry | — | ❌ | Only admin generation is tested |

---

## Admin

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Admin invites page loads | `tests/admin-invites-ui.spec.ts` | ✅ | Skips for non-admin users |
| Admin invite stats cards | `tests/admin-invites-ui.spec.ts` | ✅ | Total/Used/Unused/Expired |
| Generate single invite code | `tests/admin-invites-ui.spec.ts` | ✅ | Button click + table row appears |
| Bulk invite code generation | `tests/admin-invites-ui.spec.ts` | ✅ | Form inputs visible |
| All Codes tab table | `tests/admin-invites-ui.spec.ts` | ✅ | Column headers asserted |
| Copy invite code to clipboard | `tests/admin-invites-ui.spec.ts` | ✅ | Best-effort (clipboard API) |
| Admin console errors check | `tests/admin-invites-ui.spec.ts` | ✅ | pageerror + console.error captured |
| Admin responsive layout | `tests/admin-invites-ui.spec.ts` | ✅ | 1920/768/375px viewports |
| Admin rules sources page | `tests/rules.spec.ts` | ⚠️ | Loads without error; skips for non-admin |
| Admin user management | — | ❌ | No test coverage |

---

## Campaigns

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Campaigns list page loads | `tests/campaigns.spec.ts`, `tests/smoke/campaigns.smoke.spec.ts` | ✅ | Heading or empty state |
| New campaign link visible | `tests/campaigns.spec.ts` | ✅ | Role=link assertion |
| New campaign link navigates to create page | `tests/campaigns.spec.ts` | ✅ | URL + heading check |
| Campaign create form — empty name validation | `tests/campaigns.spec.ts`, `tests/workflows/validation-edge.spec.ts` | ✅ | Zod `.trim().min(1)` error shown |
| Campaign create form — successful submit | `tests/workflows/campaign-create.spec.ts` | ✅ | Redirects to campaign slug URL |
| Campaign detail page loads | `tests/smoke/campaigns.smoke.spec.ts` | ✅ | Heading visible |
| Campaign overview (navigation link) | `tests/smoke/navigation-links.smoke.spec.ts` | ⚠️ | No-error check only |
| Campaign edit/update | — | ❌ | Settings save tested in webhooks.spec.ts but not as campaign edit |
| Campaign delete — danger zone section | `tests/webhooks.spec.ts` | ✅ | "Danger Zone" heading or button visible |
| Campaign delete — confirmation dialog | — | ❌ | Button exists test only; actual delete flow untested |
| Campaign slug uniqueness | — | ❌ | No test |
| New campaign form — /campaigns/new loads | `tests/workflows/campaign-create.spec.ts` | ✅ | "Campaign Identity" heading + inputs visible |

---

## Sessions & Prep

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Sessions list page loads | `tests/sessions.spec.ts`, `tests/smoke/session-core.smoke.spec.ts` | ✅ | Heading or empty state |
| New session button visible for DMs | `tests/sessions.spec.ts` | ✅ | Link or button check |
| Session create dialog opens | `tests/sessions-edge.spec.ts` | ✅ | Dialog or textbox visible |
| Session create — empty title validation | `tests/sessions-edge.spec.ts` | ✅ | No 500; form stays open |
| Session create — very long title handled | `tests/sessions-edge.spec.ts` | ✅ | No 500 or crash |
| Session list status filters (All/Planned/etc.) | `tests/sessions-edge.spec.ts` | ✅ | Filter button visible + functional |
| Session detail page loads | `tests/transcript.spec.ts` (helper), `tests/rules.spec.ts` | ⚠️ | Indirect; no direct session detail load test |
| Session detail — Transcript tab | `tests/transcript.spec.ts` | ✅ | Tab or text visible |
| Session detail — Live Play tab | `tests/encounter-ui-review.spec.ts` | ✅ | Tab click + panel visible |
| Session detail — Recap tab | `tests/transcript.spec.ts` | ✅ | Tab navigation tested (state persistence) |
| Session prep (Lazy DM wizard) | — | ❌ | No Playwright test; UI exists via CockpitPrepReferencePanel |
| Session cockpit (/live route) | — | ❌ | No test; layout group `(session)` exists |
| Session cockpit — Party Overview panel | — | ❌ | No test |
| Session cockpit — Live Notes panel + auto-save | — | ❌ | No test |
| Session cockpit — Combat panel | — | ❌ | No test |
| Session cockpit — NPC Quick Recall | — | ❌ | No test |
| Session cockpit — Dice roller dialog | — | ❌ | No test |
| Session cockpit — End session dialog | — | ❌ | No test |
| Session cockpit — Mode switcher (RP/Combat) | — | ❌ | No test |
| Session public share page (unauthenticated) | `tests/sessions-edge.spec.ts` | ✅ | Conditional on share link existing |
| AI session summary generation | — | ❌ | Worker exists, no E2E test |
| AI prep suggestions / DM hints feed | — | ❌ | No test |
| Player recap (shared session view) | — | ❌ | No test |
| Derailment detector | — | ❌ | No test |

---

## Transcription & Recording

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Transcript tab loads on session detail | `tests/transcript.spec.ts` | ✅ | Tab or heading visible |
| Empty transcript state shown | `tests/transcript.spec.ts` | ✅ | "No transcripts yet" text |
| DM can edit transcript segment inline | `tests/transcript.spec.ts` | ✅ | Conditional on DM role + existing data |
| DM can rename speaker across segments | `tests/transcript.spec.ts` | ✅ | Conditional on speaker-labelled segments |
| Player cannot edit transcript segments | `tests/transcript.spec.ts` | ✅ | Conditional on player role |
| Long transcript scroll stability | `tests/transcript.spec.ts` | ✅ | Conditional on 20+ segments |
| Transcript search state persistence on tab switch | `tests/transcript.spec.ts` | ✅ | Conditional on search field existing |
| Audio/video upload UI | — | ❌ | No test; transcription worker exists |
| Live transcription (AssemblyAI WebSocket) | — | ❌ | No test |
| Transcription worker queue | — | ❌ | No test |
| Recording upload + processing | — | ❌ | No test |

---

## AI Features

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| AI summaries page loads | `tests/smoke/navigation-links.smoke.spec.ts` | ⚠️ | No-error check only (campaign-summaries route) |
| AI session summary generation | — | ❌ | No test |
| AI prep suggestions | — | ❌ | No test |
| AI encounter generation | `tests/encounter-ui-review.spec.ts` | ✅ | "Generate Encounter" button + difficulty toggle; actual generation not triggered |
| Narrative search — page loads | `tests/search.spec.ts` | ✅ | URL and error check |
| Narrative search — input present | `tests/search.spec.ts` | ✅ | Textbox visible |
| Narrative search — empty query handled | `tests/search.spec.ts` | ✅ | No crash |
| Narrative search — XSS handled safely | `tests/search.spec.ts` | ✅ | `window.__xss` not set |
| Narrative search — URL-encoded query handled | `tests/search.spec.ts` | ✅ | No crash |
| Narrative search — no-results state | `tests/search.spec.ts` | ✅ | "No results" or empty body |
| Narrative search — entity type filters | `tests/search.spec.ts` | ✅ | Filter buttons visible |
| Narrative search embeddings | — | ❌ | Worker exists, no test |
| Homebrew AI extraction (Ollama/Gemini/OpenAI) | — | ❌ | No test |
| Homebrew extraction result displayed | — | ❌ | No test |
| Feedback triage via Claude CLI | — | ❌ | Worker exists, no E2E test |
| Image generation worker | — | ❌ | No test |
| Derailment detector | — | ❌ | No test |

---

## Characters

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Characters page loads | `tests/characters.spec.ts` | ✅ | Via `/characters` route |
| Characters list (Players tab) loads | `tests/characters.spec.ts` | ✅ | Heading or empty state |
| Empty state — no characters in campaign | `tests/characters.spec.ts` | ✅ | Conditional |
| D&D Beyond import UI visible for DMs | `tests/characters.spec.ts` | ✅ | Conditional on DM role |
| D&D Beyond URL validation (rejects non-DDB URLs) | `tests/characters.spec.ts` | ✅ | Error message asserted |
| Character detail page — key stats | `tests/characters.spec.ts` | ✅ | Conditional on character existing |
| Character delete confirmation dialog | `tests/characters.spec.ts` | ✅ | Dialog + cancel tested |
| Player cannot see DM-only character controls | `tests/characters.spec.ts` | ✅ | Conditional on player role |
| Character sheet tabs (Overview/Spells/Inventory/etc.) | — | ❌ | No test |
| Active effects / conditions panel | — | ❌ | No test |
| Character builder (manual creation) | — | ❌ | No test |
| Homebrew-to-character attachment | — | ❌ | No test |
| D&D Beyond sync / refresh | — | ❌ | No test |

---

## Homebrew

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Homebrew library page loads | `tests/homebrew.spec.ts`, `tests/smoke/homebrew-npcs.smoke.spec.ts` | ✅ | Heading or empty state |
| Campaign homebrew page loads | `tests/homebrew.spec.ts`, `tests/smoke/homebrew-npcs.smoke.spec.ts` | ✅ | Heading asserted |
| Create homebrew manually | `tests/homebrew.spec.ts` | ✅ | Name visible in list after create |
| Empty state — no homebrew in campaign | `tests/homebrew.spec.ts` | ✅ | Conditional |
| Player cannot see DM-only create/add controls | `tests/homebrew.spec.ts` | ✅ | Conditional on player role |
| Delete homebrew — confirmation dialog | `tests/homebrew.spec.ts` | ✅ | Conditional on delete button existing |
| Delete homebrew — item removed from list | `tests/homebrew.spec.ts` | ✅ | Name has count 0 after delete |
| Non-PDF file upload shows error | `tests/homebrew.spec.ts` | ✅ | Toast or error message visible |
| Search filters homebrew list | `tests/homebrew.spec.ts` | ✅ | Created item appears after filter |
| Clicking homebrew item opens detail page | `tests/homebrew.spec.ts` | ✅ | URL pattern and heading check |
| PDF processing page loads | `tests/smoke/homebrew-pdf-list.smoke.spec.ts` | ✅ | Upload button, empty state, or table |
| PDF upload file input + file chooser | `tests/workflows/homebrew-pdf-upload-ui.spec.ts` | ✅ | File input count=1, chooser event fires |
| PDF detail — View PDF tab appears | `tests/pdf-viewer-tab.spec.ts` | ✅ | Conditional on completed PDF existing |
| PDF detail — Extracted Content tab | `tests/pdf-viewer-tab.spec.ts` | ✅ | Tab visible on completed PDF |
| PDF detail — Raw Markdown tab | `tests/pdf-viewer-tab.spec.ts` | ✅ | Tab visible on completed PDF |
| PDF viewer — page navigation controls | `tests/pdf-viewer-tab.spec.ts` | ✅ | Prev/Next/ZoomIn/ZoomOut buttons |
| PDF viewer — page counter (N/M) | `tests/pdf-viewer-tab.spec.ts` | ✅ | Span matches `\d+ / \d+` pattern |
| PDF viewer — zoom controls change percentage | `tests/pdf-viewer-tab.spec.ts` | ✅ | 100% → 125% → 75% |
| Homebrew DnD Beyond import | — | ❌ | Router exists (`homebrewDndBeyond`), no test |
| Homebrew DnD Beyond import dialog | — | ❌ | No test |
| Obsidian vault import | — | ❌ | No test |
| Homebrew extraction — spell/monster/item schemas | — | ❌ | No test |

---

## NPCs

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| NPC list loads for a campaign | `tests/npcs.spec.ts`, `tests/smoke/homebrew-npcs.smoke.spec.ts` | ✅ | Heading or empty state |
| New NPC button/link visible for DMs | `tests/npcs.spec.ts` | ✅ | Link or button check |
| NPC create — empty name validation | `tests/workflows/validation-edge.spec.ts` | ✅ | "Name is required" shown |
| NPC create — with D&D 5e stat block | `tests/workflows/npc-detail-required-sections.spec.ts` | ✅ | Full stat block fields filled + submitted |
| NPC detail — stat block sections rendered | `tests/workflows/npc-detail-required-sections.spec.ts` | ✅ | CR, Traits, Actions, Reactions, Legendary Actions |
| NPC detail — alignment, saves, skills, senses | — | ❌ | Form fields exist (feat d5cd091), no detail-view test |
| NPC detail — size, traits, reactions, legendary | `tests/workflows/npc-detail-required-sections.spec.ts` | ✅ | Present in test |
| NPC detail — condition immunities, vulnerabilities | — | ❌ | Fields exist (feat acd8e19), no test |
| NPC search / quick recall (cockpit) | — | ❌ | No test |
| NPC edit / update | — | ❌ | No test |
| NPC delete | — | ❌ | No test |

---

## Encounters

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Encounters page loads | `tests/encounters.spec.ts`, `tests/encounter-ui-review.spec.ts` | ✅ | URL and error check |
| Empty state — no encounter plans | `tests/encounters.spec.ts` | ✅ | Conditional |
| New Plan button opens dialog | `tests/encounters.spec.ts`, `tests/encounter-ui-review.spec.ts` | ✅ | Dialog visible |
| Create encounter plan — empty name validation | `tests/encounters.spec.ts` | ✅ | No 500 |
| Difficulty labels on plan cards | `tests/encounters.spec.ts` | ✅ | Conditional on plans existing |
| Encounter plan detail loads | `tests/encounters.spec.ts`, `tests/encounter-ui-review.spec.ts` | ✅ | URL pattern + no error |
| Encounter plan delete — confirm dialog | `tests/encounters.spec.ts` | ✅ | Conditional on delete button |
| Encounters tab appears in campaign nav | `tests/encounter-ui-review.spec.ts` | ✅ | nav link visible |
| New Encounter DM controls visible | `tests/encounter-ui-review.spec.ts` | ✅ | Button enabled |
| Builder — all major sections rendered | `tests/encounter-ui-review.spec.ts` | ✅ | Name/Party/Level/Tabs |
| Builder — Combat tab | `tests/encounter-ui-review.spec.ts` | ✅ | Tab visible + clickable |
| Builder — Story tab (scene/tactical notes) | `tests/encounter-ui-review.spec.ts` | ✅ | Fields visible, save tested |
| Builder — AI Generate tab | `tests/encounter-ui-review.spec.ts` | ✅ | Difficulty toggle + example prompt |
| Builder — difficulty meter (Easy/Medium/Hard/Deadly) | `tests/encounter-ui-review.spec.ts` | ✅ | All 4 labels visible |
| Monster Picker — SRD monsters | `tests/encounter-ui-review.spec.ts` | ✅ | Search + CR filter + card click |
| Monster Picker — Campaign NPCs tab | `tests/encounter-ui-review.spec.ts` | ✅ | Tab switch |
| Monster Picker — Homebrew tab | `tests/encounter-ui-review.spec.ts` | ✅ | Tab switch |
| Add monster to encounter | `tests/encounter-ui-review.spec.ts` | ✅ | "Add to encounter" button visible |
| Save Plan — persists story data | `tests/encounter-ui-review.spec.ts` | ✅ | Save button click, no crash |
| Encounters index shows plan cards after creation | `tests/encounter-ui-review.spec.ts` | ✅ | Count >= 1 |
| Live encounter tracker on session page | `tests/encounter-ui-review.spec.ts` | ✅ | Conditional on session existing |
| Live encounter create in tracker | `tests/encounter-ui-review.spec.ts` | ✅ | Conditional on input visible |
| Builder responsive at 768px | `tests/encounter-ui-review.spec.ts` | ✅ | Save button visible at tablet width |
| Initiative tracker / turn order | — | ❌ | Client-side state; no test |

---

## Integrations

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Webhooks — campaign settings page loads with webhook section | `tests/webhooks.spec.ts` | ✅ | "webhook" or "integration" text visible |
| Webhooks — URL field accepts HTTPS | `tests/webhooks.spec.ts` | ✅ | No validation error on valid URL |
| Webhooks — invalid URL prevents save | `tests/webhooks.spec.ts` | ✅ | No 500; form-level error |
| Webhooks — empty URL handled | `tests/webhooks.spec.ts` | ✅ | No 500 |
| Campaign settings save with valid data | `tests/webhooks.spec.ts` | ✅ | No 500 after save |
| Campaign settings — Danger Zone section | `tests/webhooks.spec.ts` | ✅ | Heading or delete button visible |
| Foundry integration | — | ❌ | Router exists (`foundry`), no UI test |
| D&D Beyond character import | `tests/characters.spec.ts` | ✅ | UI visibility + URL validation |
| D&D Beyond homebrew import | — | ❌ | No test |
| Obsidian vault import | — | ❌ | No test |
| Stripe billing — pricing page | `tests/billing.spec.ts` | ✅ | Free/Pro/Team plans visible, no JS errors |
| Stripe billing — manage subscription for subscribed user | `tests/billing.spec.ts` | ✅ | Conditional on subscription |
| Stripe billing — current plan badge in settings | `tests/billing.spec.ts` | ✅ | "Free/Pro/Team plan" text visible |
| Stripe billing — upgrade CTA for free tier | `tests/billing.spec.ts` | ✅ | Conditional on free tier |
| Stripe billing — usage meters and limits | `tests/billing.spec.ts` | ✅ | Labels visible in settings |
| Stripe billing — free tier defaults (None subscription) | `tests/billing.spec.ts` | ✅ | "None" text visible |
| Discord feedback thread creation | — | ❌ | Worker exists, no E2E test |
| Feedback widget — submit report | — | ❌ | Widget exists, no test |
| Feedback widget — screenshot capture | — | ❌ | No test |
| n8n QA trigger webhook | — | ❌ | Internal infra; no test |
| Resend email — welcome email | — | ❌ | No test |
| Resend email — invite email | — | ❌ | No test |
| Resend email — password reset email | — | ❌ | No test |

---

## Members & Invites

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Members tab loads for DMs | `tests/members.spec.ts` | ✅ | URL check |
| Invite dialog opens | `tests/members.spec.ts` | ✅ | Dialog visible after button click |
| Member list shows existing members | — | ❌ | No assertion on member rows |
| Player join from invite link (happy path) | `tests/personas/player-join.persona.spec.ts` | 🔧 | test.fixme |
| Player join — invalid/expired invite error | `tests/personas/player-join.persona.spec.ts` | 🔧 | test.fixme |
| Role-based access — player cannot see DM controls | `tests/homebrew.spec.ts`, `tests/characters.spec.ts` | ✅ | Conditional |

---

## Settings

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| Settings page loads | `tests/smoke/navigation-links.smoke.spec.ts` | ⚠️ | No-error check only |
| Billing section — plan badge | `tests/billing.spec.ts` | ✅ | "Free/Pro/Team plan" |
| Billing section — usage meters | `tests/billing.spec.ts` | ✅ | Section labels visible |
| Billing section — manage subscription button | `tests/billing.spec.ts` | ✅ | Conditional on subscription |
| Gemini API key field | — | ❌ | Added 2026-03-01, no test |
| User settings (display name etc.) | — | ❌ | No test |
| Password change | — | ❌ | No test |

---

## Persona & Cross-cutting Flows

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| New DM onboarding → first campaign → first NPC | `tests/personas/new-dm.persona.spec.ts` | 🔧 | test.fixme — 2 tests stubbed |
| New DM — validation on invalid campaign submit | `tests/personas/new-dm.persona.spec.ts` | 🔧 | test.fixme |
| Power DM — high-volume NPC/homebrew import flow | `tests/personas/power-dm.persona.spec.ts` | 🔧 | test.fixme — 2 tests stubbed |
| Power DM — heavy page degradation detection | `tests/personas/power-dm.persona.spec.ts` | 🔧 | test.fixme |
| Veteran DM — rapid navigation + advanced NPC | `tests/personas/veteran-dm.persona.spec.ts` | 🔧 | test.fixme — 2 tests stubbed |
| Veteran DM — blocked action shows clear error | `tests/personas/veteran-dm.persona.spec.ts` | 🔧 | test.fixme |
| Mobile DM — critical routes on phone viewport | `tests/personas/mobile-dm.persona.spec.ts` | 🔧 | test.fixme — iPhone 13 device |
| Mobile DM — layout break detection | `tests/personas/mobile-dm.persona.spec.ts` | 🔧 | test.fixme |
| Error resilience — app recovers from transient 500 | `tests/personas/error-resilience.persona.spec.ts` | 🔧 | test.fixme |
| Error resilience — hard failure shows user error | `tests/personas/error-resilience.persona.spec.ts` | 🔧 | test.fixme |

---

## Navigation (Smoke)

| Feature | Test File | Status | Notes |
|---------|-----------|--------|-------|
| /dashboard loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New; networkidle + body check |
| /campaigns loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /characters loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /homebrew loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /homebrew/pdfs loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /settings loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug] loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New; uses vics-test-campaign |
| /campaigns/[slug]/sessions loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/npcs loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/members loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/homebrew loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/summaries loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New; AI recaps page |
| /campaigns/[slug]/encounters loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/search loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| /campaigns/[slug]/settings loads without error | `tests/smoke/navigation-links.smoke.spec.ts` | ✅ | New |
| Core nav routes (dashboard/campaigns/characters/homebrew) | `tests/smoke/navigation-core.smoke.spec.ts` | ✅ | No heading check; superseded by navigation-links |

---

## Coverage Summary

| Category | ✅ Active | ⚠️ UI Only | 🔧 Stubbed | ❌ No Test | Total |
|----------|-----------|------------|------------|------------|-------|
| Authentication & Access | 6 | 0 | 0 | 4 | 10 |
| Admin | 8 | 1 | 0 | 1 | 10 |
| Campaigns | 7 | 1 | 0 | 5 | 13 |
| Sessions & Prep | 9 | 2 | 0 | 15 | 26 |
| Transcription & Recording | 7 | 0 | 0 | 4 | 11 |
| AI Features | 8 | 0 | 0 | 8 | 16 |
| Characters | 7 | 0 | 0 | 5 | 12 |
| Homebrew | 14 | 0 | 0 | 6 | 20 |
| NPCs | 5 | 0 | 0 | 4 | 9 |
| Encounters | 16 | 0 | 0 | 1 | 17 |
| Integrations | 9 | 0 | 0 | 10 | 19 |
| Members & Invites | 2 | 0 | 2 | 1 | 5 |
| Settings | 3 | 1 | 0 | 3 | 7 |
| Persona & Cross-cutting | 0 | 0 | 10 | 0 | 10 |
| Navigation (Smoke) | 16 | 0 | 0 | 0 | 16 |
| **Total** | **117** | **5** | **12** | **67** | **201** |

**Active or UI coverage: 122 / 201 (61%)**
**Stubbed (fixme): 12 / 201 (6%)**
**No test: 67 / 201 (33%)**

### Highest-priority gaps
1. Session cockpit (`/live` route) — 8 sub-features, zero coverage
2. AI summaries / AI prep — worker infrastructure exists, no E2E trigger
3. Foundry integration — router exists, no UI test
4. Homebrew DnD Beyond import — router exists, no test
5. Obsidian vault import — documented as upcoming, no test
6. Audio/video upload and transcription pipeline — BullMQ workers exist, no E2E
7. All 10 persona tests are fixme stubs — real DM journey coverage missing
