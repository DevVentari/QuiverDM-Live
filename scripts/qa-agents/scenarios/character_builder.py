"""
Scenario: Builder Beth creates a character using the character builder.

Persona: Builder Beth (uses Nora's account)
Flow: Sign in → campaign → characters → create new → fill all tabs → save → verify
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create a new D&D character using the character builder.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Open "Nora's First Adventure" from the dashboard (or any available campaign)
4. Navigate to the Characters section of the campaign
5. Click "New Character" or equivalent
6. Fill in the Details tab:
   - Name: Elara Brightwood
   - Level: 3
   - Alignment: Neutral Good
7. Find and fill the Race selection — choose Human
8. Find and fill the Class selection — choose Fighter
9. Find and fill the Background selection — choose Soldier
10. Find the Ability Scores / Stats section — use Standard Array or point buy if available
    Assign: STR 16, DEX 13, CON 14, INT 10, WIS 12, CHA 8 (or closest available)
11. Save the character
12. Verify the character appears in the characters list

Pay attention to:
- Are all expected D&D 5e tabs/sections present?
- Do class, race, background options include standard 5e choices?
- Are ability score modifiers shown automatically?
- Is anything clearly missing that a D&D player would expect?

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill:
   [QA-AGENT] Persona: Beth | Scenario: character_builder | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (character created), PARTIAL (created but missing features), or FAILED.
"""
