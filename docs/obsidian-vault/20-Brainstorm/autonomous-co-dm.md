# Phase 4 — Autonomous Co-DM
> Real-Time Narrative Operator

The Autonomous Co-DM exists inside Session Mode, powered by DM Brain. It does four jobs simultaneously: Observe, Understand, Predict, Assist (without interrupting).

## Core Design Rule
The Co-DM must never replace authority. It should feel like a hyper-competent assistant quietly sliding notes across the table.

## System Flow
```
Players Speak
      ↓
Audio / Notes / Actions
      ↓
Live Context Parser
      ↓
DM Brain
      ↓
Co-DM Decision Engine
      ↓
Suggestions + Automation
```

No chat window required.

## 1. Live Observation Layer

Continuously tracks:

**Conversation**
- NPC names spoken, goals discussed, threats implied, emotional tone

**Mechanics**
- HP trends, spell depletion, combat pacing

**Narrative**
- Ignored hooks, recurring themes, faction involvement

**Example Detection:**
Player says "We should probably burn the archive."
System registers: Intent=Destruction, Target=Archive, Narrative Impact=EXTREME, Faction Risk=HIGH → DM receives quiet alert.

## 2. Predictive Scene Assistance

Before problems occur.

Example: Combat at 28 minutes, engagement falling → Co-DM suggests "Introduce environmental collapse? / Enemy morale break possible." One-click execution.

## 3. Autonomous NPC Intelligence

Each NPC has: Goals, Fear, Loyalty, Secrets, Stress Level. Co-DM updates behavior live.

Example:
```
Guard Captain Rhea
Confidence ↓  Fear ↑
Escape likelihood: 62%
Suggested action: Rhea attempts retreat.
```
DM approves or ignores.

## 4. Improvisation Engine

When players derail, DM presses ⚡ IMPROVISE → Co-DM instantly generates believable NPC + motive + faction ties + future consequences. World-consistent generation using DM Brain — not random content.

## 5. Encounter Autopilot

Optional co-management:
- Roll minor enemies
- Track conditions
- Manage recharge abilities
- Update initiative

DM focuses on narration. System shows "NEXT: Withering Shade / Recharge Available ✓ / Legendary Action Suggested."

## 6. Narrative Continuity Guard

Prevents lore mistakes silently. DM says "Temmel has never been here." → Co-DM flags "Temmel visited Session 6." No immersion break.

## 7. Dynamic World Reaction

Actions propagate between sessions. Players assassinate noble → Co-DM schedules: Rumor Spread, Guard Alert Increase, Political Instability. Future sessions evolve automatically.

## 8. Emotional Table Awareness (Advanced)

Tone + pacing signal detection:
- Boredom, confusion, spotlight imbalance
- "Player Adam inactive 18 minutes → suggest engagement moment"
- Revolutionary for online tables.

## 9. Autonomous Prep Between Sessions

Post-session background jobs: update NPC motivations, advance faction timelines, resolve unattended threats, generate rumors, prepare opening scene. Next session begins alive.

## 10. Interaction Model / UI

**Confidence threshold behavior:**
| Confidence | Behavior |
|-----------|---------|
| Low | Silent |
| Medium | Sidebar hint |
| High | Highlight |
| Critical | Alert |

**UI presence** — minimal orb/panel bottom-right:
```
● Co-DM Active
Context Stable
3 Suggestions Ready
```
Expandable only when needed. No constant popup spam.

## 11. Permission Levels

1. Manual Mode
2. Assist Mode
3. Auto Mechanical
4. Full Co-DM

Trust grows over time.

## 12. Architecture

```
DM Brain
   ↓
Context Stream
   ↓
Decision Models
   ↓
Action Generator
   ↓
Session UI
```

**Recommended agents:**
- Event Interpreter
- NPC Reasoner
- Encounter Manager
- Narrative Planner
- Player Behavior Analyzer

## Result

At Phase 4, QuiverDM becomes:
- Campaign remembers itself
- NPCs think
- World evolves
- Prep shrinks
- DM cognitive load collapses

**Category:** Not a Foundry competitor. Not an Obsidian competitor. Not a D&D Beyond competitor.

**AI-Augmented Tabletop Engine** — an entirely new category.

## Dependencies / Prerequisites
- Session Mode Dashboard (Phase 3)
- DM Brain (context store + entity graph)
- Live Transcription (already built — AssemblyAI + WebSocket)
- Session Continuity Graph (NPC/quest state)
- Encounter Builder (already built — F3)
- AI Summaries worker (already built — F1)
