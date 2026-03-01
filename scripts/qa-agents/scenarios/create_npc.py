"""
Scenario: Veteran Vic creates an NPC with a full stat block in his existing campaign.

Steps the agent attempts:
1. Sign in as Vic
2. Navigate to "Vic's Test Campaign"
3. Go to the NPCs section of the campaign
4. Create a new NPC — fill name, CR, HP, AC, stats
5. Check that D&D 5e defaults/options are correct
6. Save and verify the NPC appears in the list
7. Report any D&D inaccuracies or missing fields via feedback overlay
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create a new NPC with a complete stat block inside an existing campaign, like an experienced DM preparing for a session.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Find "Vic's Test Campaign" in your dashboard or campaigns list and open it
4. Look for an NPCs section (sidebar, tab, or menu item)
5. Create a new NPC with these details:
   - Name: Theron the Bandit Captain
   - Challenge Rating: 2
   - HP: 65
   - AC: 15
   - Strength: 16, Dexterity: 15, Constitution: 16, Intelligence: 14, Wisdom: 11, Charisma: 14
   - Type: Humanoid
6. Save the NPC
7. Verify it appears in the NPC list

Pay attention to:
- Are all standard 5e stat block fields present?
- Are CR options correct (not just integers — includes 0, 1/8, 1/4, 1/2)?
- Are ability score modifiers calculated automatically?
- Is anything a D&D player would expect missing or wrong?

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill description:
   [QA-AGENT] Persona: Vic | Scenario: create_npc | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (NPC created with full stat block), PARTIAL (created but missing fields), or FAILED.
"""
