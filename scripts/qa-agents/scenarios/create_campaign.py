"""
Scenario: New DM Nora creates her first campaign.

Steps the agent attempts:
1. Navigate to sign-in page and log in as Nora
2. Complete onboarding flow (welcome → profile → create first campaign)
3. If onboarding is skipped/broken, navigate to /dashboard and click "New Campaign"
4. Fill in campaign name and submit
5. Verify the campaign page loads
6. If friction encountered at any step, use the feedback overlay to report it
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create your first D&D campaign as a brand new user.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Complete any onboarding steps that appear (welcome screen, profile setup, campaign creation wizard)
4. If you land on a dashboard with no campaigns, click "New Campaign" or equivalent button
5. Fill in a campaign name: "Nora's First Adventure"
6. Submit and confirm the campaign was created (you should see a campaign page or dashboard with the campaign listed)

When you encounter any problem — button doesn't work, page is confusing, error appears, something is slow:
1. Look for the feedback button in the bottom-right corner of the page (a small icon or "Feedback" label)
2. Click it to open the feedback form
3. Select type: Bug (for errors/broken things) or Feature (for missing/unclear things)
4. Fill description: [QA-AGENT] Persona: Nora | Scenario: create_campaign | Step: <what you were doing> | Issue: <what went wrong>
5. Submit the feedback form
6. Then continue trying to complete the scenario

Report any friction you encounter, even if you eventually work around it.
At the end, report your final outcome: SUCCESS (campaign created), PARTIAL (got partway), or FAILED (could not proceed).
"""
