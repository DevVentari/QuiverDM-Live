"""Scenario: Create a full NPC stat block and verify all fields."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Create an NPC with a complete D&D 5e stat block and verify correctness.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign from your dashboard (or navigate to /campaigns)
3. Go to NPCs section of the campaign
4. Click "New NPC"
5. Fill ALL available fields:
   - Name: Kira the Shadow Witch
   - CR: 5
   - HP: 78, AC: 14
   - STR 10, DEX 17, CON 14, INT 16, WIS 12, CHA 18
   - Type: Humanoid, Alignment: Neutral Evil
   - Speed: 30ft
   - Fill any Description or Notes field with: "A cunning spellcaster who trades secrets"
6. Save the NPC
7. Open the saved NPC detail page — verify all fields saved correctly
8. Check: are ability modifiers shown auto-calculated? (DEX 17 = +3, CHA 18 = +4)
9. Navigate back to NPC list — verify Kira appears

REPORT at the end:
- SUCCESS: all fields present, saved correctly, modifiers calculated
- PARTIAL: created but some fields missing or wrong
- FAILED: could not create NPC

Note any fields you expected but were absent (saving throws, skills, senses, languages, etc).
"""
