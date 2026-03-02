"""Scenario: Create a character and verify all builder tabs render."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Create a character and verify the builder covers standard D&D 5e options.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign from the dashboard
3. Navigate to Characters — click "New Character" or "Add Character"
4. Fill in every available field/tab:
   - Name: Elara Brightwood, Level: 3
   - Race: Human (or Human variant if available)
   - Class: Fighter
   - Background: Soldier
   - Ability scores: assign STR 16, DEX 13, CON 14, INT 10, WIS 12, CHA 8
   - Any other tabs (Equipment, Spells, Notes) — open each and note what's there
5. Save the character
6. Open the character detail page — verify name, level, class all show correctly
7. Navigate back to characters list — verify Elara appears

REPORT:
- SUCCESS: character created with all expected fields, all tabs loaded
- PARTIAL: created but some tabs missing or fields wrong
- FAILED: could not complete character creation

List which tabs existed, any absent expected options (subclass, feats, skills), any broken UI.
"""
