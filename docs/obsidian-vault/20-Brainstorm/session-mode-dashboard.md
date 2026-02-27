# Session Mode Dashboard

> The screen that stays open for 4 hours. A DM should never need to navigate menus mid-session.

## Core Principle

Session Mode = zero navigation gameplay UI. Think: OBS control panel + Foundry combat + Notion live notes, but story-aware.

During a session, the DM constantly needs: party state, initiative/combat readiness, NPC recall, notes capture, rule lookup, improvisation tools. The UI surfaces all simultaneously.

## Layout Grid

```
┌────────────────────────────────────────────┐
│ ACTIVE SESSION HEADER                      │
├───────────────┬────────────────────────────┤
│ PARTY STATE   │ LIVE SCENE / NOTES         │
│               │                            │
├───────────────┼────────────────────────────┤
│ QUICK NPC     │ DM TOOLS                   │
│ + ENCOUNTERS  │                            │
└────────────────────────────────────────────┘
```

No page switching. Everything live.

## Panels

### 1. Active Session Header (always visible)
- Session name, number, elapsed timer
- Autosave indicator, transcription status
- Buttons: End Session | Combat Mode | Pause Notes

### 2. Party State Panel (left)
- HP bar, conditions, initiative order, spell slots, inspiration, death saves
- Color logic: Healthy=purple, Hurt=amber, Critical=red pulse, Downed=flash
- One glance → full table health read

### 3. Live Scene / Notes (center)
- **Layer A**: Free-type live notes
- **Layer B**: AI overlay auto-generated from transcription
  - Current scene, active NPCs, unresolved hooks
  - Updates without DM input — narrative thread never lost

### 4. Quick NPC + Encounter Panel (right)
- Zero-friction search — typing "tem" instantly surfaces Temmel's card
- Card shows: name, epithet, disposition, secrets known, last seen
- Actions: Speak As NPC | Add To Scene | Start Encounter

### 5. Combat Mode (UI morphs, not navigates)
- Transition animation reorganizes panels in place
- Initiative tracker replaces party state panel
- Side tools: damage quick-apply, condition toggles, legendary actions, environment effects

### 6. DM Tools Panel (bottom-right permanent)
- Roll | Generate NPC | Suggest Twist | Random Event | Spawn Encounter
- Panic buttons for player derailment

### 7. Real-Time AI DM Assistant (floating, not chat)
- Context engine surfacing relevant lore when players mention things
- Pacing alerts (e.g., "Combat running long — morale break at Round 5?")
- This is QuiverDM's identity feature

### 8. Session Capture Pipeline (invisible)
- Audio → Whisper → scene detection → NPC tagging → event extraction → summary
- Status strip: Recording ● | Transcript Updating… | Summary Ready ✓
- DM does nothing

### 9. End Session Flow
- Auto prompt: generate summary, update character journals, extract new NPCs, update timeline, create next prep tasks
- One click → campaign evolves automatically

## UX Rule
> One glance → one decision → one click. No scrolling. No navigation. No modal overload.

## Mode Map
| Mode | Purpose |
|------|---------|
| Dashboard | Campaign overview |
| Campaign | Planning |
| Character | Management |
| Homebrew | Creation |
| **Session Mode** | **PLAY** |

Most VTTs fail at Session Mode. This is QuiverDM's differentiation layer.

## Implementation Notes
- Builds on existing: live transcription (AssemblyAI + WebSocket), AI summaries, encounter builder, NPC search (MeiliSearch), party/character state
- Combat Mode UI morph: CSS grid reconfiguration + animation, no route change
- AI context alerts: lightweight hook watching transcript + session state, pattern matching against campaign entities
- End session pipeline: already partially implemented in F1 AI Summaries worker
