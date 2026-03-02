"""
Scenario: Session Sam runs through the full session lifecycle.

Persona: Session Sam (uses Dana's account)
Flow: Sign in → campaign → create session → fill prep wizard → start session →
      verify cockpit loads → end session → verify redirect to session detail
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: run a complete session lifecycle — from creating a session through to ending it.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Open "Dana's Test Campaign" from the dashboard
4. Navigate to the Sessions section
5. Create a new session named "Test Session — Lifecycle"
6. In the session detail page, find and open the Prep Wizard
7. Fill in at least:
   - Strong Start: "The party arrives at the ruined castle"
   - Scene 1: "Encounter with the bandits in the courtyard"
   - Secret 1: "The captain is actually an undercover city guard"
8. Save the prep wizard
9. Click "Launch Session" (or equivalent) to open the session cockpit
10. In the cockpit, verify these panels load:
    - A timer (running or paused)
    - A party overview panel (even if empty)
    - A notes panel
11. End the session using the end session button or toolbar
12. Verify you are redirected back to the session detail page (not the cockpit)

When you encounter any problem — button missing, page errors, panel not loading:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug, fill:
   [QA-AGENT] Persona: Sam | Scenario: session_lifecycle | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (full lifecycle completed), PARTIAL (got partway), or FAILED.
"""
