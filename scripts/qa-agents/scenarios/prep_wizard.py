"""Scenario: Complete all 8 prep wizard steps and test AI suggestions."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Fill all 8 Lazy DM prep steps and verify AI suggestion features work.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign, go to Sessions
3. Open an existing session or create one named "QA Prep Test"
4. Open the Prep Wizard
5. Fill ALL 8 steps as fast as possible:
   - Strong Start: "Dragon attacks the village at dawn"
   - Scenes: "Rescue survivors from burning buildings", "Pursue dragon to its lair"
   - Secrets: "The dragon is actually cursed — a transformed knight", "The village elder summoned it"
   - Locations: "The blackened market square", "Dragon's mountain lair entrance"
   - NPCs: "Elder Marta (guilty, terrified)", "Sir Aldric (the cursed dragon)"
   - Monsters: "Young Red Dragon (cursed form)", "Dragon Cultists x6"
   - Magic Items: "Ring of Dragon Command (hidden in lair)"
   - Story Questions: "Will the party break the curse or slay the dragon?"
6. Find any "AI Suggest" or "Generate" button — click it and wait up to 15 seconds
7. Note: did suggestions appear? What did they suggest?
8. Save or mark prep as complete

REPORT:
- SUCCESS: all 8 steps accessible and saved, AI suggestions appeared
- PARTIAL: steps worked but AI suggestions failed or didn't appear
- FAILED: wizard broken or could not complete steps

List which steps had AI suggestion buttons, response time, and quality of suggestions.
"""
