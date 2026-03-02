"""Scenario: Encounter Eddie builds and runs an encounter."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Test the encounter builder — create, populate, and run an encounter.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign — find the Encounters section (sidebar or campaign nav)
3. Click "New Encounter" — fill: Name="QA Bandit Ambush", description="Roadside ambush"
4. Add monsters to the encounter:
   - Add "Bandit" x3 (search or type — verify autocomplete or manual entry works)
   - Add "Bandit Captain" x1
5. Add any player characters if the option exists
6. Save the encounter
7. Click "Start" or "Run Encounter" — verify initiative tracker loads
8. In the tracker, verify:
   - All combatants listed with HP
   - An "Add HP" / "Damage" action exists per combatant
   - There is a "Next Turn" or initiative advance button
9. Deal 10 damage to one combatant — verify HP updates
10. End or exit the encounter — verify you return to encounter list

REPORT:
- SUCCESS: encounter created, tracker loaded, HP tracking works
- PARTIAL: encounter created but tracker had issues
- FAILED: could not find encounters or tracker broken

List every URL. Note any missing features (conditions, recharge abilities, death saves).
"""
