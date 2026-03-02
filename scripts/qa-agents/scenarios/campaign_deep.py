"""
Scenario: Campaign Carl does a deep audit of campaign overview and navigation.

Persona: Campaign Carl (uses Nora's account)
Flow: Sign in → campaign overview → verify all sections → navigate each tab →
      check empty states vs data → verify sidebar navigation
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: do a thorough walkthrough of a campaign's overview and all its navigation sections.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Open any available campaign from the dashboard
4. On the campaign overview page, check that these sections render (even if empty):
   - Sessions list or count
   - NPCs list or count
   - Characters list or count
   - Encounters (if present)
   - Recent activity or summary
5. Navigate to each major section using the sidebar or tabs:
   a. Sessions — verify list loads (empty state or entries)
   b. NPCs — verify list loads
   c. Characters — verify list loads
   d. Homebrew or library (if accessible from campaign)
   e. Campaign settings or overview
6. For each section, check:
   - Does the page load without errors?
   - Is there a clear empty state message if no data?
   - Does the "Create New" button exist where expected?
7. Test sidebar navigation — click between sections and verify each loads correctly
8. Go back to the campaign overview and verify it still loads

Pay attention to:
- Any sections that fail to load or show errors
- Missing "Create New" buttons or unclear how to add content
- Navigation items that lead to 404 or broken pages
- Inconsistent layouts between sections

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill:
   [QA-AGENT] Persona: Carl | Scenario: campaign_deep | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (all sections rendered and navigable), PARTIAL (some sections had issues), or FAILED.
"""
