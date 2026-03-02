"""
Scenario: Prep Pete fills out the full prep wizard for a session.

Persona: Prep Pete (uses Dana's account)
Flow: Sign in → campaign → session → prep wizard → fill all 8 Lazy DM steps →
      try AI suggestions → verify suggestions appear → complete prep
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: fill out the complete 8-step Lazy DM prep wizard for a session, including testing AI suggestions.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Open "Dana's Test Campaign" from the dashboard
4. Navigate to Sessions, then open or create a session named "Test Prep Session"
5. Find and open the Prep Wizard for this session
6. Fill in all 8 Lazy DM steps:
   Step 1 — Strong Start: "The party discovers a crumbling tower at dusk with smoke rising from the top"
   Step 2 — Scenes/Encounters: "Ambush by goblin scouts on the road", "Parley with the bandit leader"
   Step 3 — Secrets/Clues: "The tower was once a wizard's lab", "The bandit leader is fleeing from the city guard"
   Step 4 — Fantastic Locations: "The collapsed library inside the tower with floating books"
   Step 5 — NPCs: "Mira the bandit captain (nervous, hides a terrible secret)"
   Step 6 — Monsters: "Goblin scouts x4, Bandit Captain"
   Step 7 — Magic Items: "Scroll of Invisibility found in the tower"
   Step 8 — Story Questions: "Will the party help Mira escape the city guard or turn her in?"
7. Look for an "AI Suggest" button near Strong Start or Scenes — click it
8. Verify that AI suggestions appear (even if they take a few seconds)
9. Save or complete the prep wizard

Pay attention to:
- Are all 8 steps clearly labeled and present?
- Does the AI suggestion feature work (shows a loading state, then suggestions)?
- Is there a clear "save" or "complete" action?
- Any confusing UX or missing features?

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill:
   [QA-AGENT] Persona: Pete | Scenario: prep_wizard | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (all steps filled + AI suggestions appeared), PARTIAL (filled but AI didn't work), or FAILED.
"""
