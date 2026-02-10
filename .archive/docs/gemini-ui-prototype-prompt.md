### Gemini 3 UI Prototype Prompt for QuiverDM

**Project:** QuiverDM

**Objective:** Generate a single-file HTML UI prototype for a new dashboard for QuiverDM, a campaign management tool for Dungeon Masters (DMs) of tabletop role-playing games (TTRPGs). This prototype should serve as a visual reference and inspiration for the final UI.

**Core Features to Showcase:**

*   **Campaign Management:** Display a list of the user's campaigns.
*   **Character Management:** Show a gallery of the user's characters.
*   **Session Tracking:** Indicate upcoming or active sessions.
*   **Homebrew Content:** Provide access to a "homebrew" section for user-created content.
*   **Quick Actions:** Include buttons for common actions like creating a new campaign, character, or joining a campaign.

**Design & Aesthetic:**

*   **Theme:** Dark, immersive fantasy. Think of a digital Dungeon Master's screen, a scholar's desk, or a candle-lit tavern.
*   **Color Palette:**
    *   **Backgrounds:** Dark, warm, "creamy" tones (e.g., `#0f0d0b`, `#1a1714`).
    *   **Text:** Off-white/parchment colors for primary text (`#e8dcc8`), and a more muted, secondary color (`#a89968`).
    *   **Accents:** A warm, golden-yellow for buttons, links, and highlights (`#d4a84b`).
*   **Typography:**
    *   **Headings:** Use the `Cinzel` font (from Google Fonts), which has a classic, chiseled, fantasy look.
    *   **Body Text:** Use the `Crimson Text` font (from Google Fonts) for paragraphs and smaller text.
*   **Layout:**
    *   A clean, modern dashboard layout.
    *   Use card-based elements to organize different sections (e.g., a card for each campaign, a section for characters, etc.).
    *   The layout should be responsive and work well on both desktop and mobile devices.

**Specific UI Elements to Design:**

1.  **Global Navigation Bar:**
    *   A sticky header with the application logo ("QuiverDM") and links to the main sections (Campaigns, Characters, Homebrew).
    *   Include a user profile dropdown with the user's name and avatar.

2.  **Dashboard Welcome Header:**
    *   A prominent welcome message (e.g., "Welcome back, Dungeon Master").

3.  **Contextual Banner:**
    *   A banner at the top of the dashboard that highlights important information, such as an active session or a pending invitation to a campaign.

4.  **Character Section:**
    *   A horizontally scrolling list of character cards.
    *   Each character card should display the character's portrait (or a class icon as a fallback), name, race, class, and level.

5.  **Campaign Section:**
    *   A list of campaign cards or rows.
    *   Each campaign card should show the campaign name, the user's role (DM or Player), and some key stats (e.g., number of sessions, number of players).

6.  **Quick Actions:**
    *   A set of buttons for quick access to common actions like "Create Campaign", "Create Character", and "Join Campaign".

**Technical Specifications for the Prototype:**

*   **Format:** A single HTML file.
*   **Styling:** Use a `<style>` block within the HTML file for all CSS. Do not use external stylesheets.
*   **Frameworks:** You can use Tailwind CSS utility classes directly in the `class` attributes of the HTML elements, as the final implementation will use Tailwind. However, all styling should be self-contained within the HTML file.
*   **JavaScript:** No JavaScript is necessary for this prototype. It should be purely static HTML and CSS.

**Example Snippet (for a card):**

You can use this as a starting point for the card style:

```html
<div style="background-color: #1a1714; border: 1px solid #3d3530; border-radius: 2px; padding: 1.5rem;">
  <h3 style="font-family: 'Cinzel', serif; color: #e8dcc8; font-size: 1.25rem;">Card Title</h3>
  <p style="font-family: 'Crimson Text', serif; color: #a89968;">This is some body text for the card.</p>
</div>
```

By following these guidelines, you will create a UI prototype that is not only visually appealing but also highly relevant to the project's goals and technical stack.
