"""
D&D Beyond Character Scraper - JSON Extraction Method
Extracts character data from embedded JSON in D&D Beyond pages.
"""

import sys
import io
import json
import asyncio
import os
import re

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Suppress rich console output from crawl4ai
os.environ['CRAWL4AI_SILENT'] = '1'
os.environ['TERM'] = 'dumb'

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def scrape_character(url: str):
    """Scrape D&D Beyond character using JSON extraction"""

    # Suppress Crawl4AI logging
    import logging
    logging.getLogger('crawl4ai').setLevel(logging.ERROR)

    # Configure browser
    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        extra_args=["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox"],
    )

    # Configure crawler
    crawl_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for="body",
        js_code=[
            # Wait for character data to load
            "await new Promise(r => setTimeout(r, 3000));",
        ],
        wait_for_images=False,
        screenshot=False,
    )

    # Temporarily redirect stdout to suppress progress output
    original_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(
                url=url,
                config=crawl_config
            )
    finally:
        sys.stdout = original_stdout

    if not result.success:
        raise Exception(f"Failed to crawl: {result.error_message}")

    html = result.html

    # Try to find embedded JSON data
    # D&D Beyond typically embeds character data in window.__INITIAL_STATE__ or similar

    # Method 1: Look for __INITIAL_STATE__ or similar global variables
    json_patterns = [
        r'window\.__INITIAL_STATE__\s*=\s*({.+?});',
        r'window\.DDC\s*=\s*({.+?});',
        r'var\s+CHARACTER_DATA\s*=\s*({.+?});',
        r'<script[^>]*>.*?var\s+character\s*=\s*({.+?})</script>',
    ]

    character_json = None
    for pattern in json_patterns:
        match = re.search(pattern, html, re.DOTALL)
        if match:
            try:
                character_json = json.loads(match.group(1))
                break
            except:
                continue

    # If no JSON found, fall back to HTML parsing
    if not character_json:
        from lxml import html as lxml_html
        tree = lxml_html.fromstring(html)

        # Helper functions
        def get_text(xpath, default=""):
            elements = tree.xpath(xpath)
            return elements[0].text_content().strip() if elements else default

        def get_attr(xpath, attr, default=""):
            elements = tree.xpath(xpath)
            return elements[0].get(attr, default).strip() if elements else default

        # Extract basic info from HTML
        character_name = (
            get_text("//h1[contains(@class, 'styles_characterName')]") or
            get_text("//div[contains(@class, 'ddbc-character-tidbits__heading')]") or
            "Unknown Character"
        )

        race = get_text("//span[contains(@class, 'ddbc-character-summary__race')]") or "Unknown"
        class_text = get_text("//span[contains(@class, 'ddbc-character-summary__classes')]") or ""

        # Parse class and level
        character_class = re.sub(r'\d+', '', class_text).strip() if class_text else "Unknown"
        level = 1
        level_match = re.search(r'\d+', class_text)
        if level_match:
            level = int(level_match.group())

        image_url = get_attr("//img[contains(@class, 'ddbc-character-avatar__portrait')]", "src", "")

        return {
            "characterName": character_name,
            "playerName": None,
            "race": race,
            "class": character_class,
            "level": level,
            "imageUrl": image_url if image_url else None,
            "backstory": None,
            "background": None,
            "abilityScores": {"str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10},
            "skills": [],
            "proficiencies": [],
            "proficiencyBonus": 2,
            "armorClass": 10,
            "hitPoints": {"current": 0, "max": 0, "temp": 0},
            "speed": "30 ft.",
            "features": [],
            "feats": [],
            "equipment": [],
            "spells": [],
            "spellSlots": {},
            "note": "JSON extraction failed - using basic HTML parsing"
        }

    # Parse JSON data (structure varies by D&D Beyond version)
    try:
        # Extract data from JSON structure
        character_data = parse_character_json(character_json)
        return character_data
    except Exception as e:
        raise Exception(f"Failed to parse character JSON: {str(e)}")


def parse_character_json(data: dict):
    """Parse D&D Beyond JSON data structure"""

    # The structure varies, so we need to be flexible
    # Common paths: data.character, data.characters[0], etc.

    character = None
    if 'character' in data:
        character = data['character']
    elif 'characters' in data and len(data['characters']) > 0:
        character = data['characters'][0]
    else:
        # Try to find character in nested structure
        for key, value in data.items():
            if isinstance(value, dict) and ('name' in value or 'characterName' in value):
                character = value
                break

    if not character:
        raise Exception("Could not find character data in JSON")

    # Extract data
    result = {
        "characterName": character.get('name') or character.get('characterName') or 'Unknown',
        "playerName": character.get('playerName'),
        "race": character.get('race', {}).get('fullName') or character.get('race') or 'Unknown',
        "class": extract_class_name(character.get('classes', [])),
        "level": sum(c.get('level', 0) for c in character.get('classes', [])) if 'classes' in character else 1,
        "background": character.get('background', {}).get('name') if isinstance(character.get('background'), dict) else character.get('background'),
        "imageUrl": extract_image_url(character),
        "backstory": character.get('notes', {}).get('backstory') or character.get('backstory'),
        "abilityScores": extract_ability_scores(character.get('stats', [])),
        "skills": extract_skills(character.get('skills', [])),
        "proficiencies": extract_proficiencies(character),
        "proficiencyBonus": character.get('proficiencyBonus', 2),
        "armorClass": character.get('armorClass') or 10,
        "hitPoints": {
            "current": character.get('currentHitPoints', 0),
            "max": character.get('maxHitPoints') or character.get('baseHitPoints', 0),
            "temp": character.get('temporaryHitPoints', 0)
        },
        "speed": f"{character.get('speed', 30)} ft.",
        "features": extract_features(character),
        "feats": extract_feats(character.get('feats', [])),
        "equipment": extract_equipment(character.get('inventory', [])),
        "spells": extract_spells(character.get('spells', [])),
        "spellSlots": extract_spell_slots(character.get('spellSlots', {}))
    }

    return result


def extract_class_name(classes):
    """Extract class name(s) from classes array"""
    if not classes:
        return "Unknown"
    class_names = [c.get('definition', {}).get('name') or c.get('name', '') for c in classes]
    return ' / '.join(filter(None, class_names))


def extract_image_url(character):
    """Extract character image URL"""
    avatar = character.get('avatarUrl') or character.get('decorations', {}).get('avatarUrl')
    if avatar:
        return avatar
    # Check for portrait
    portrait = character.get('portraitUrl')
    if portrait:
        return portrait
    return None


def extract_ability_scores(stats):
    """Extract ability scores from stats array"""
    ability_map = {1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha'}
    scores = {}

    for stat in stats:
        stat_id = stat.get('id')
        if stat_id in ability_map:
            scores[ability_map[stat_id]] = stat.get('value', 10)

    # Fill in defaults for missing abilities
    for ability in ['str', 'dex', 'con', 'int', 'wis', 'cha']:
        if ability not in scores:
            scores[ability] = 10

    return scores


def extract_skills(skills):
    """Extract skills with modifiers"""
    result = []
    for skill in skills:
        if isinstance(skill, dict):
            result.append({
                "name": skill.get('name') or skill.get('definition', {}).get('name', 'Unknown Skill'),
                "modifier": f"+{skill.get('modifier', 0)}" if skill.get('modifier', 0) >= 0 else str(skill.get('modifier', 0))
            })
    return result


def extract_proficiencies(character):
    """Extract proficiencies"""
    profs = []

    # Weapon proficiencies
    weapon_profs = character.get('modifiers', {}).get('race', []) + character.get('modifiers', {}).get('class', [])
    for prof in weapon_profs:
        if prof.get('type') == 'proficiency':
            profs.append(prof.get('friendlyTypeName', 'Unknown Proficiency'))

    return profs


def extract_features(character):
    """Extract features and traits"""
    features = []

    # Class features
    for cls in character.get('classes', []):
        for feature in cls.get('classFeatures', []):
            if isinstance(feature, dict):
                features.append({
                    "name": feature.get('name') or feature.get('definition', {}).get('name', 'Unknown Feature'),
                    "description": feature.get('description') or feature.get('snippet', '')
                })

    # Racial traits
    race_traits = character.get('race', {}).get('racialTraits', [])
    for trait in race_traits:
        if isinstance(trait, dict):
            features.append({
                "name": trait.get('name') or trait.get('definition', {}).get('name', 'Unknown Trait'),
                "description": trait.get('description') or trait.get('snippet', '')
            })

    return features


def extract_feats(feats):
    """Extract feats"""
    result = []
    for feat in feats:
        if isinstance(feat, dict):
            result.append({
                "name": feat.get('name') or feat.get('definition', {}).get('name', 'Unknown Feat'),
                "description": feat.get('description') or feat.get('snippet', '')
            })
    return result


def extract_equipment(inventory):
    """Extract equipment from inventory"""
    equipment = []
    for item in inventory:
        if isinstance(item, dict):
            equipment.append({
                "name": item.get('name') or item.get('definition', {}).get('name', 'Unknown Item'),
                "quantity": item.get('quantity', 1)
            })
    return equipment


def extract_spells(spells):
    """Extract spell list"""
    result = []
    for spell in spells:
        if isinstance(spell, dict):
            definition = spell.get('definition', {})
            result.append({
                "name": definition.get('name', 'Unknown Spell'),
                "level": definition.get('level', 0),
                "school": definition.get('school', {}).get('name', '') if isinstance(definition.get('school'), dict) else definition.get('school', '')
            })
    return result


def extract_spell_slots(spell_slots):
    """Extract spell slot information"""
    slots = {}
    if isinstance(spell_slots, dict):
        for level, slot_info in spell_slots.items():
            if isinstance(slot_info, dict):
                slots[f"level{level}"] = {
                    "total": slot_info.get('total', 0),
                    "used": slot_info.get('used', 0)
                }
    return slots


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No URL provided",
            "usage": "python crawl_dndbeyond_json.py <url>"
        }, ensure_ascii=False))
        sys.exit(1)

    url = sys.argv[1]

    try:
        # Run async scraping
        result = asyncio.run(scrape_character(url))
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "url": url
        }, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
