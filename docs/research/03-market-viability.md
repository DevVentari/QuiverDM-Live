# Market Viability Analysis: TTRPG Software / SaaS

*Research compiled February 2026. Data sourced from industry reports, platform disclosures, and community analysis.*

---

## 1. Market Size

### Overall TTRPG Market

The global TTRPG market was valued at approximately **$1.9–2.0 billion in 2024**, across physical and digital channels. Forecasts project the market reaching **$6.59 billion by 2035**, implying a sustained CAGR of ~11.84% over the decade.

| Metric | Figure |
|---|---|
| Global TTRPG market (2024) | ~$1.9B |
| Global TTRPG market (2026 projection) | ~$2.41B |
| Global TTRPG market (2035 projection) | ~$6.59B |
| CAGR (2026–2035) | ~11.84% |
| Digital tabletop platforms market (2024) | ~$1.68B |
| Digital tabletop platforms market (2033 projection) | ~$5.23B (CAGR 13.9%) |

Note: The market cooled from its COVID-era peak in 2024, with North American hobby channel retail sales flat to slightly down. However, digital sales, crowdfunding, and direct-to-consumer channels offset weaker physical retail performance.

### D&D / TTRPG Player Base

- **50 million** people worldwide have played D&D at some point (lifetime).
- **~13.7 million** active tabletop D&D players estimated worldwide.
- **19 million** registered users on D&D Beyond as of 2024.
- **12 million** registered users on Roll20 (up from 8 million in 2020).
- Virtual tabletop adoption among players: **48% in 2024**, up from 29% in 2020.
- VTTs now support **55% of global campaigns**.

### Post-COVID Growth

The pandemic (2020–2021) drove a massive surge in online play. D&D and the TTRPG category broadly gained millions of new players. While the market has normalized since 2022–2023, it has not receded — the player base remains permanently larger than pre-2020, and digital tool adoption has become standard rather than optional.

### WotC / D&D Revenue Signal

- WotC tabletop revenue (D&D + Magic): **$1.04B in 2024**.
- At the July 2024 investor meeting, Hasbro CEO Chris Cocks confirmed that **D&D Beyond digital revenue accounts for over half of all D&D profits**.
- **60% of D&D's revenue** now flows through direct-to-consumer channels (up from 0% in 2022 before the D&D Beyond acquisition).
- Hasbro acquired D&D Beyond from Fandom in April 2022 for **$146.3 million** — a clear signal of the value assigned to digital tooling in this space.

---

## 2. Competitive Landscape

### Direct Competitors

#### D&D Beyond (WotC / Hasbro)
- **Type:** Character builder, rules compendium, digital books, basic VTT.
- **Price:** Master Tier ~$55/year (~$4.60/mo). Content sold separately per book ($30+).
- **Strengths:** Official WotC content, largest user base (19M registered), deep D&D 5e integration, recently launched a basic browser VTT.
- **Weaknesses:** Locked to D&D 5e / WotC content. No session management, no transcription, no homebrew AI tools, no AI summaries, no audio ingest. Primarily a reference tool, not a campaign management tool.

#### Roll20
- **Type:** Browser-based VTT. Focus on maps, tokens, dice.
- **Price:** Plus tier ~$49.99/year (~$4.17/mo), Pro tier ~$99.99/year (~$8.33/mo).
- **Users:** 12 million registered (2024).
- **Strengths:** Market leader in VTT. Large community. System-agnostic.
- **Weaknesses:** Aging UI, no AI features, no session transcription or summaries, no homebrew extraction. Revenue has not been publicly reported but pricing has been raised, suggesting margin pressure.

#### Foundry VTT
- **Type:** Self-hosted VTT with rich plugin ecosystem.
- **Price:** One-time license, $50 for the GM. No subscription.
- **Strengths:** Won "VTT of the Year" in 2024. Extremely extensible. Active developer community. Now has official D&D content support.
- **Weaknesses:** Requires self-hosting (technical barrier). No SaaS recurring revenue model. No built-in AI, no campaign narrative tools.

#### Fantasy Grounds
- **Type:** Veteran VTT (since 2004). Most official system licenses.
- **Price:** Ultimate license $149.99 one-time, or $9.99/month (GM subscription).
- **Strengths:** Most licensed content of any VTT. Strong rules automation.
- **Weaknesses:** Dated UI. Steep learning curve. No AI features. Niche audience.

#### Shard Tabletop
- **Type:** Browser-based VTT targeting accessibility.
- **Price:** Freemium with paid tiers.
- **Strengths:** Clean player-facing UI. Low barrier to entry.
- **Weaknesses:** Limited fog-of-war and lighting tools. Small ecosystem. No AI features.

#### Alchemy RPG
- **Type:** Newer VTT focused on streaming and presentation.
- **Price:** Freemium with subscription for advanced features.
- **Strengths:** Built-in streaming tools, spectator mode, scene-first design.
- **Weaknesses:** Small content library. Niche (streaming-focused). No AI session tools.

### AI-Adjacent Competitors

Several AI tools have entered the DM-assistance space, but none have built an integrated campaign management platform:

- **AI Dungeon / HyperWrite AI DM / AI Realm:** Text-adventure AI assistants or chatbot-based DMs. Not campaign management software.
- **Archivist (myarchivist.ai):** Session recap and campaign memory tooling. Closest functional overlap with QuiverDM's summary/memory features.
- **ChatGPT / Claude (used ad hoc):** Many DMs use general-purpose AI for NPC generation, world-building, etc. but with no TTRPG-specific context, session history, or homebrew integration.

### Where Competitors Fall Short

| Capability | D&D Beyond | Roll20 | Foundry VTT | Any current tool? |
|---|---|---|---|---|
| Session transcription | No | No | No | No (integrated) |
| AI session summaries | No | No | No | No (integrated) |
| Homebrew PDF extraction | No | No | Limited | No (AI-powered) |
| Campaign narrative memory | No | No | No | No |
| Session recording management | No | No | No | No |
| Cross-session NPC continuity | No | No | No | No |
| Encounter builder (SRD-aware) | Partial | No | Via modules | No (native AI) |
| Rules RAG (homebrew-aware) | No | No | No | No |

**QuiverDM's core differentiators are not incremental UI improvements — they address entirely absent categories in the current market.**

---

## 3. Monetization Viability

### What the Market Supports

The existing tool pricing benchmarks establish clear willingness-to-pay anchors:

- Roll20 Pro: ~$8.33/month — for maps, tokens, and dice. No AI.
- Fantasy Grounds: $9.99/month — for legacy rules automation.
- D&D Beyond: ~$4.60/month — for a rules reference + character builder.
- Character.AI+ (general AI): $9.99/month.

**A $9–15/month tier for an AI-powered campaign management platform is well within established willingness-to-pay for this demographic.** DMs, who shoulder the majority of session prep work, are the most motivated and highest-value segment to monetize — they demonstrably pay for tools.

### Recommended Pricing Structure

| Tier | Price | Target |
|---|---|---|
| Free | $0 | Players, light DMs, trial |
| DM Pro | $9–12/month | Active DMs (primary monetization) |
| Team | $15–20/month | Campaigns with multiple contributors |

A freemium model with DM-focused paid features (transcription minutes, AI summary generation, PDF extraction quota) aligns with what the market already pays for lesser tools.

### Creator Economy Potential

The TTRPG creator economy is large and growing:
- Over **3,500 TTRPG Kickstarter/Gamefound projects funded annually**, 72% success rate.
- **Independent creators account for 58%** of all new TTRPG systems released in 2023.
- **DriveThruRPG** and **Itch.io** indie uploads grew 44% year-over-year in 2023–2024.
- DriveThruRPG takes a **35% cut**; Patreon takes **10%**. A platform offering better economics for digital TTRPG content has a clear pitch.

A future marketplace for DM templates, campaign modules, homebrew packages, and NPC libraries (sold through QuiverDM) could generate meaningful take-rate revenue without requiring WotC-licensed content.

### B2B Potential

- **Game stores:** Could use QuiverDM to run in-store organized play events and manage their player/DM communities.
- **Convention organizers:** Gen Con 2024 had 71,000+ unique attendees. Session scheduling, DM tools, and event campaign tracking are underserved.
- **Publishers:** Third-party TTRPG publishers (Paizo, Kobold Press, MCDM, Darrington Press) need digital tooling for their systems that D&D Beyond does not support. QuiverDM's system-agnostic homebrew extraction and rules RAG create a clear B2B pitch to mid-tier publishers.
- **Professional DMs:** The professional DM market (via StartPlaying.games) charges $20–$100/session. These power users have the highest willingness-to-pay for productivity tools.

---

## 4. Key Risks

### Risk 1: D&D Beyond / WotC Platform Lock-In

D&D Beyond is now a $146M asset that generates over 50% of D&D's profits. WotC has deep resources to add features over time. D&D Beyond's recently launched basic VTT drove **weekly traffic up ~50%**. If WotC builds AI summaries or session tooling into D&D Beyond, it would significantly compress QuiverDM's addressable market among D&D 5e players specifically.

**Mitigation:** QuiverDM is system-agnostic. D&D Beyond is locked to official WotC content and will not support Pathfinder, OSR, custom homebrew systems, or the growing ecosystem of ORC-licensed games. The ORC license (Paizo-led, 2023) is creating a second major tier of TTRPG publishing outside WotC's reach.

### Risk 2: Market Fragmentation

D&D is approximately 40–50% of the TTRPG market by revenue. The remaining 50–60% is split across Pathfinder 2e, OSR systems, Call of Cthulhu, MÖRK BORG, Blades in the Dark, Shadowrun, and hundreds of indie systems. No single VTT or management platform dominates across systems.

**Mitigation:** Fragmentation is also an opportunity. QuiverDM's AI approach (audio-to-text, PDF extraction, system-agnostic rules RAG) works across any system. The competitor most harmed by fragmentation is D&D Beyond; QuiverDM benefits from it.

### Risk 3: AI Skepticism in the TTRPG Community

The TTRPG community has expressed significant concern about generative AI:
- The **ENNIE Awards** (2025–2026 cycle) banned all AI-generated content from submissions.
- WotC faced community backlash when AI art was found in *Glory of the Giants*.
- DriveThruRPG has instituted AI disclosure policies. Reddit and Discord communities frequently have anti-AI rules.

The concerns center primarily on **AI replacing human creative work** (writing, art) and the use of stolen training data.

**Mitigation:** QuiverDM uses AI as a **personal productivity tool for the DM's own campaign** — not to generate publishable content or replace artists. Transcribing your own sessions, summarizing your own game, and extracting rules from your own purchased PDFs does not fall in the category of contested AI content generation. Clear messaging that QuiverDM enhances the DM's creativity rather than replacing it is essential. Avoid generative art as a core feature.

### Risk 4: Piracy of PDF Extraction

The homebrew PDF extraction feature could draw scrutiny if used to circumvent purchased content licensing. Publishers and WotC could object to automated content extraction even from legitimately purchased books.

**Mitigation:** Frame the feature as personal use — users upload their own purchased PDFs for their own campaign. Do not host or redistribute extracted content. Add clear ToS language.

---

## 5. Opportunity Gaps

### Gap 1: No Tool Does Session Memory Well

Every DM struggles with continuity. "What did we do last session? What did the players agree to? What's the name of the blacksmith in Waterdeep?" No current tool maintains an indexed, searchable campaign narrative log automatically. QuiverDM's transcription + AI summary + vector search pipeline directly addresses this gap.

27% of surveyed TTRPG players report demand for AI-enhanced NPC continuity and memory tools. 37% cite retention issues (players forgetting the story). 54% report content overload for DMs.

### Gap 2: Audio Is Entirely Unserved

Sessions happen. Audio exists. Nothing in the current market turns that audio into structured campaign records automatically. This is a workflow that genuinely does not exist elsewhere as an integrated product.

### Gap 3: Homebrew Rules Are Stranded in PDFs

Third-party publishers, indie games, and homebrewed content live in PDFs that no existing VTT or campaign manager can ingest and reason over. QuiverDM's PDF extraction + rules RAG creates a new capability category.

### Gap 4: The DM's Preparation Workflow Is Unaddressed

Current tools are predominantly session-runtime tools (VTTs, dice rollers, map viewers). Pre-session planning, encounter design, NPC writing, and post-session documentation are done in Google Docs, Notion, or physical notebooks. There is no purpose-built DM campaign management system in the market.

### Gap 5: System-Agnostic AI Assistance

D&D Beyond's AI roadmap serves only D&D 5e. The other ~50% of the TTRPG market — Pathfinder, OSR, indie systems — has no AI campaign management option at all. This is QuiverDM's clearest addressable whitespace.

---

## Summary

| Dimension | Assessment |
|---|---|
| Market size | $1.9B physical+digital (2024), growing ~12% CAGR |
| Player TAM | 50M lifetime players; ~14M active; 12–19M digital platform users |
| Willingness to pay | $5–15/month well established; DMs pay more than players |
| Competitive white space | Session memory, audio ingest, homebrew AI, system-agnostic — all unserved |
| Primary risk | WotC adding AI to D&D Beyond; AI community skepticism |
| Primary opportunity | DM workflow tools are completely absent from the market |
| Creator economy | Large, growing, underserved by existing revenue-share platforms |
| B2B angle | Third-party publishers, game stores, pro DMs represent reachable segments |

The TTRPG software market is large enough ($1.9B+), growing fast enough (~12% CAGR), and sufficiently underserved in the DM-workflow and AI tooling categories that a focused SaaS product targeting active DMs has a credible path to sustainable revenue. The absence of any tool that does what QuiverDM does — session transcription, AI summaries, homebrew extraction, cross-session narrative memory — is not an oversight but a genuine product gap that incumbents are structurally unable to fill quickly.

---

## Sources

- [Worldwide TTRPG Market in 2024 – Industry Analysis (RPGDrop)](https://www.rpgdrop.com/worldwide-ttrpg-market-in-2024-industry-analysis/)
- [TTRPG Market Size, Trend, 2035 (Business Research Insights)](https://www.businessresearchinsights.com/market-reports/tabletop-role-playing-game-ttrpg-market-110856)
- [TTRPG Market Size & Share | CAGR of 11.88% (Industry Research)](https://www.industryresearch.biz/market-reports/tabletop-role-playing-game-ttrpg-market-105312)
- [TTRPG Market Outlook 2024–2033: Data, Trends & Forecasts](https://www.collettivoantracite.it/en/ttrpg-market-forecast-2024-2033/)
- [How Many People Play D&D in 2024? (Fiction Horizon)](https://fictionhorizon.com/how-many-people-play-dd/)
- [How many people play DnD? 2024 statistics (Dice Cove)](https://dicecove.com/resources/statistics/)
- [How Many D&D Players Are There Worldwide? (Dungeon Vault)](https://dungeonvault.com/how-many-dnd-players-are-there-worldwide/)
- [Digital Tabletop Platforms Market Research Report 2033 (Growth Market Reports)](https://growthmarketreports.com/report/digital-tabletop-platforms-market)
- [D&D Beyond – Wikipedia](https://en.wikipedia.org/wiki/D%26D_Beyond)
- [Roll20 – Wikipedia](https://en.wikipedia.org/wiki/Roll20)
- [Foundry VTT vs Roll20 (2025) (My Virtual Tabletop)](https://myvtt.games/blog/foundry-vtt-vs-roll20-2025-which-vtt-is-better)
- [A Comprehensive List of Virtual Tabletops – Updated 2025 (StartPlaying)](https://startplaying.games/blog/posts/a-comprehensive-list-of-virtual-tabletops)
- [Hasbro Acquires D&D Beyond for $146.3M (Xfire)](https://www.xfire.com/hasbro-wotc-dnd-beyond-dungeons-and-dragons-fandom-150-million-b28b)
- [WotC and Magic Sales Dip in Q4 and 2024 (DDO Players)](https://ddoplayers.com/2025/02/25/wotc-and-magic-sales-dip-in-q4-and-2024-hasbro-has-hopes-for-2025/)
- [Hasbro Q3 Report Shows Decline in D&D Revenue (Tabletop Gaming News)](https://www.tabletopgamingnews.com/hasbros-q3-report-shows-decline-in-dd-revenue-despite-2024-launch/)
- [D&D Beyond – A VTT Developer's Perspective (Arkenforge)](https://arkenforge.com/dd-beyond-purchase-a-vtts-perspective/)
- [TTRPG Market Share on Roll20 (The RPG Site)](https://www.therpgsite.com/pen-paper-roleplaying-games-rpgs-discussion/ttrpg-market-share-on-roll20/)
- [The Future of Tabletop RPGs: Trends to Watch in 2025 and Beyond (RPGDrop)](https://www.rpgdrop.com/the-future-of-tabletop-roleplaying-games-trends-to-watch-in-2025-and-beyond/)
- [Best Digital TTRPG Tools Comparison 2025 (Nurl)](https://nurlttrpg.com/blog/digital-tabletop-gaming-tools)
- [ENNIE Awards Revised Policy on Generative AI](https://ennie-awards.com/revised-policy-on-generative-ai-usage/)
- [We Need to Have Another Talk About AI (Cannibal Halfling Gaming)](https://cannibalhalflinggaming.com/2024/10/01/another-talk-about-ai/)
- [Embracing AI in TTRPGs – Enhancing, Not Replacing, Creativity (Optional Rule)](https://www.optionalrule.com/2024/09/20/ethical-ai-in-ttrpgs/)
- [All The Ways You Can Make Money in TTRPGs (StartPlaying)](https://startplaying.games/blog/posts/how-to-make-money-dnd-ttrpgs)
- [Pay-to-Play: The Business of the Professional Dungeon Master (TTRPG Insider)](https://www.ttrpginsider.news/p/pay-to-play-the-business-of-the-professional-dungeon-master)
- [Looking Back: TTRPG Industry Professionals on the Takeaways of 2025 (TTRPG Insider)](https://www.ttrpginsider.news/p/looking-back-ttrpg-industry-professionals-on-the-takeaways-of-2025)
- [Top 10 TTRPG Companies in Global 2024 (Global Growth Insights)](https://www.globalgrowthinsights.com/blog/role-playing-game-ttrpg-companies-232)
