"""
Scenario: Power DM Dana uploads a PDF homebrew source.

Steps the agent attempts:
1. Sign in as Dana
2. Navigate to homebrew section (top nav or sidebar)
3. Find the "Upload PDF" or "Add Source" option
4. Upload a test PDF (use a small public domain PDF if available, or note missing file)
5. Wait for processing and verify the source appears
6. Report friction at any step via feedback overlay
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: upload a PDF as a homebrew source, like a DM would when importing a rulebook or supplement.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Navigate to the Homebrew section (look in the sidebar or top navigation)
4. Look for an option to upload or import a PDF
5. If a file picker appears, note that you cannot actually select a file in this test — report if the upload workflow is clear and usable
6. Check if there is visual feedback about what file types/sizes are accepted
7. Navigate to any homebrew library or list view and note if it is easy to find

When you encounter any problem — button doesn't work, page is confusing, error appears, upload progress is unclear:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill description:
   [QA-AGENT] Persona: Dana | Scenario: upload_pdf | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (found and understood upload flow), PARTIAL (found it but something was unclear), or FAILED (could not find it).
"""
