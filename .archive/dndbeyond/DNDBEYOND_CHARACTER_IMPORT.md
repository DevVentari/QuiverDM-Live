# D&D Beyond Character Import

QuiverDM can import player characters from **public** D&D Beyond character sheets, similar to FoundryVTT's D&D Importer.

## Features

- ✅ Import from public D&D Beyond character URLs
- ✅ Automatically extract character data (name, race, class, level, stats, etc.)
- ✅ Import ability scores, AC, HP, skills, and more
- ✅ Import character backstory
- ✅ Import features and equipment
- ✅ Import character portrait/avatar
- ✅ Re-sync existing characters (updates data)
- ✅ Respects D&D Beyond's public sharing settings

## How to Use

### Step 1: Make Your Character Public on D&D Beyond

1. Go to your character page on D&D Beyond
2. Click the **"⚙️ Configure"** button at the top
3. Toggle **"Public"** to **ON**
4. Copy your character's URL (e.g., `https://www.dndbeyond.com/characters/12345678`)

### Step 2: Import to QuiverDM

#### Via UI (Recommended)

1. Navigate to your campaign's overview page
2. Click **"Import from D&D Beyond"** in Quick Actions
3. Optional: Enter the player's name (if different from D&D Beyond)
4. Paste the public character URL
5. Click **"Import Character"**

#### Via Test Script (for testing)

```bash
npx tsx scripts/test-dndbeyond-import.ts https://www.dndbeyond.com/characters/12345678
```

## What Gets Imported

### Basic Information
- Character name
- Player name (if available)
- Race
- Class
- Level
- Character portrait/image

### Combat Stats
- Armor Class (AC)
- Hit Points (Current, Max, Temp)
- Speed
- Proficiency Bonus

### Ability Scores
- Strength, Dexterity, Constitution
- Intelligence, Wisdom, Charisma

### Skills & Features
- Skill bonuses
- Class features
- Racial traits
- Equipment/Inventory

### Story
- Backstory text
- Character notes

## Re-Syncing Characters

If a character already exists in your campaign (same D&D Beyond URL):
- The import will **update** the existing character instead of creating a duplicate
- All data will be refreshed from D&D Beyond
- The `lastSyncedAt` timestamp will be updated

This allows players to update their characters on D&D Beyond and re-import to keep QuiverDM in sync!

## Database Storage

Character data is stored in the `Player` model with these key fields:

```typescript
{
  characterName: string;      // Character's name
  name: string;               // Player's real name
  characterRace: string;
  characterClass: string;
  level: number;
  imageUrl?: string;
  backstory?: string;
  dndBeyondUrl?: string;      // For re-syncing
  lastSyncedAt?: Date;
  characterData: Json;        // Full character stats as JSON
}
```

The `characterData` field contains:
- Ability scores
- Skills
- Features
- Equipment
- Hit points
- Armor class
- Speed
- And more

## Technical Details

### Implementation

- **Scraper**: Uses `Crawl4AI` (Python) to handle JavaScript-rendered content
- **Python Script**: `scripts/crawl_dndbeyond.py`
- **API Endpoint**: `/api/characters/import-dndbeyond`
- **Library**: `src/lib/dndbeyond-importer.ts` (calls Python subprocess)
- **Component**: `src/components/DndBeyondImport.tsx`

### Prerequisites

Crawl4AI requires Python and a headless browser:

```bash
# Install Crawl4AI
pip install crawl4ai

# Install Playwright browsers
playwright install chromium
```

These are already installed if you've followed the setup guide.

### Limitations

- ✅ **Only works with PUBLIC characters** (must be explicitly set to public on D&D Beyond)
- ❌ Cannot access private/non-shared characters
- ❌ Cannot modify characters on D&D Beyond (read-only)
- ⚠️  May break if D&D Beyond changes their HTML structure (we'll update as needed)

### Error Handling

The importer handles common errors:
- Invalid URLs
- Characters not set to public
- Network errors
- Parsing failures

If import fails, check:
1. Character is set to **Public** on D&D Beyond
2. URL is correct format: `https://www.dndbeyond.com/characters/[id]`
3. Character page loads correctly in your browser

## Legal & Ethical Notes

This feature:
- ✅ Only accesses **publicly shared** character data
- ✅ Similar to FoundryVTT's D&D Importer
- ✅ Respects D&D Beyond's public sharing settings
- ✅ Is for personal/campaign use only
- ❌ Does **not** bypass any paywalls or access restrictions
- ❌ Does **not** access private or gated content

**Important**: This is designed for players to import **their own** public characters into their DM's QuiverDM campaign, similar to how FoundryVTT works.

## Future Enhancements

Planned improvements:
- [ ] Schedule automatic re-sync (daily/weekly)
- [ ] Batch import multiple characters
- [ ] Export characters back to JSON
- [ ] Full character sheet viewer in QuiverDM
- [ ] Player-facing character sheets
- [ ] Integration with session transcripts (auto-detect character actions)

## Troubleshooting

### Character not importing?

1. **Check if character is public**: Go to D&D Beyond → Configure → Toggle "Public" ON
2. **Verify URL format**: Should be `https://www.dndbeyond.com/characters/[numbers]`
3. **Test with script**: Run `npx tsx scripts/test-dndbeyond-import.ts <url>` to see detailed error
4. **Check browser console**: Look for network errors or parsing issues

### Getting 404 errors?

- Character is likely not set to public
- URL might be incorrect or character might be deleted

### Data looks wrong?

- D&D Beyond may have updated their HTML structure
- File an issue on GitHub with the character URL and what's wrong
- We'll update the scraper to fix it

## Example Public Characters

Want to test? Here are some **example** public D&D Beyond characters you can use for testing:

*Note: You'll need to find public character URLs from the D&D Beyond community or your own public characters*

## Questions?

If you have questions or issues with character importing:
1. Check this documentation
2. Run the test script to see detailed output
3. File an issue on GitHub with details
