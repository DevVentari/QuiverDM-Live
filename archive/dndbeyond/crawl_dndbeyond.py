"""
D&D Beyond Character Scraper using Crawl4AI
Extracts character data from public D&D Beyond character sheets.
"""

import sys
import io
import json
import asyncio
import os

# Suppress rich console output from crawl4ai
os.environ['CRAWL4AI_SILENT'] = '1'
os.environ['TERM'] = 'dumb'

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

async def scrape_character(url: str):
    """Scrape D&D Beyond character using Crawl4AI"""

    # Suppress Crawl4AI logging
    import logging
    logging.getLogger('crawl4ai').setLevel(logging.ERROR)

    # Suppress all console output during crawling
    import contextlib

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

        # Extract data from the HTML using the result's markdown or html
        html = result.html

        # Parse the HTML to extract character data
        from lxml import html as lxml_html
        tree = lxml_html.fromstring(html)

        # Helper function to get text safely
        def get_text(xpath, default=""):
            elements = tree.xpath(xpath)
            return elements[0].text_content().strip() if elements else default

        def get_attr(xpath, attr, default=""):
            elements = tree.xpath(xpath)
            return elements[0].get(attr, default).strip() if elements else default

        # Extract character name
        character_name = (
            get_text("//h1[contains(@class, 'styles_characterName')]") or
            get_text("//div[contains(@class, 'ddbc-character-tidbits__heading')]") or
            get_text("//div[contains(@class, 'ddbc-character-name')]") or
            get_text("//h1[contains(@class, 'ct-character-header__name')]") or
            "Unknown Character"
        )

        # Extract player name (often not visible on public sheets)
        player_name = (
            get_text("//div[contains(@class, 'ddbc-character-player-name')]") or
            get_text("//div[contains(@class, 'ct-character-header__group--player-name')]") or
            ""
        )

        # Extract race
        race = (
            get_text("//span[contains(@class, 'ddbc-character-summary__race')]") or
            get_text("//div[contains(@class, 'ddbc-character-summary__race')]") or
            "Unknown"
        )

        # Extract class (includes level in text like "Artificer 12")
        class_text = (
            get_text("//span[contains(@class, 'ddbc-character-summary__classes')]") or
            get_text("//div[contains(@class, 'ddbc-character-summary__classes')]") or
            ""
        )

        # Extract level
        level_text = (
            get_text("//div[contains(@class, 'ddbc-character-progression-summary__level')]") or
            get_text("//div[contains(@class, 'ddbc-character-summary__level')]") or
            get_text("//span[contains(@class, 'ct-character-header-desktop__level-value')]") or
            "1"
        )

        # Parse class from class_text (e.g., "Artificer 12" -> "Artificer")
        character_class = "Unknown"
        if class_text:
            # Remove numbers and extra whitespace
            import re
            character_class = re.sub(r'\d+', '', class_text).strip()

        # Parse level from both class_text and level_text
        level = 1
        level_match = re.search(r'\d+', level_text) or re.search(r'\d+', class_text)
        if level_match:
            level = int(level_match.group())

        # Extract image
        image_url = (
            get_attr("//img[contains(@class, 'ddbc-character-avatar__portrait')]", "src") or
            get_attr("//div[contains(@class, 'ddbc-character-avatar')]//img", "src") or
            get_attr("//img[contains(@class, 'ct-character-header-desktop__avatar-image')]", "src") or
            get_attr("//img[contains(@class, 'ct-character-avatar__image')]", "src") or
            ""
        )

        # Extract ability scores
        def extract_ability_score(ability_name):
            score_xpath = f"//div[contains(@class, 'ddbc-ability-summary--{ability_name}')]//div[contains(@class, 'ddbc-ability-summary__primary')]"
            score_text = get_text(score_xpath, "10")
            try:
                return int(score_text)
            except:
                return 10

        # Try alternative method for ability scores
        ability_scores = {}
        for ability in ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']:
            score = extract_ability_score(ability)
            ability_scores[ability[:3]] = score

        # Extract AC
        ac_text = (
            get_text("//div[contains(@class, 'ddbc-armor-class-box__value')]") or
            get_text("//span[contains(@class, 'ct-combat-tablet__ac-value')]") or
            "10"
        )
        try:
            armor_class = int(ac_text)
        except:
            armor_class = 10

        # Extract HP
        current_hp_text = get_text("//span[contains(@class, 'ct-health-summary__hp-current')]", "0")
        max_hp_text = get_text("//span[contains(@class, 'ct-health-summary__hp-max')]", "0")

        try:
            current_hp = int(current_hp_text)
        except:
            current_hp = 0

        try:
            max_hp = int(max_hp_text)
        except:
            max_hp = 0

        # Extract speed
        speed = (
            get_text("//div[contains(@class, 'ct-speed-box__box-value')]") or
            get_text("//span[contains(@class, 'ddbc-distance__feet')]") or
            "30 ft."
        )

        # Extract proficiency bonus
        prof_text = (
            get_text("//div[contains(@class, 'ct-proficiency-bonus-box__value')]") or
            get_text("//span[contains(@class, 'ddbc-proficiency-bonus__value')]") or
            "+2"
        )
        try:
            proficiency_bonus = int(prof_text.replace('+', '').strip())
        except:
            proficiency_bonus = 2

        # Extract backstory
        backstory = (
            get_text("//div[contains(@class, 'ct-character-tidbits__backstory')]") or
            get_text("//div[contains(@class, 'ddbc-character-tidbits__backstory')]") or
            ""
        )

        # Extract background
        background = (
            get_text("//div[contains(@class, 'ddbc-character-summary__background')]") or
            get_text("//span[contains(@class, 'ct-character-tidbits__classes')]") or
            ""
        )

        # Extract skills
        skills = []
        skill_elements = tree.xpath("//div[contains(@class, 'ct-skills__item')] | //div[contains(@class, 'ddbc-skill')]")
        for skill_elem in skill_elements:
            try:
                skill_name = get_text(".//span[contains(@class, 'ct-skills__item-name')] | .//span[contains(@class, 'ddbc-skill__label')]", default="")
                skill_modifier = get_text(".//span[contains(@class, 'ct-skills__item-modifier')] | .//span[contains(@class, 'ddbc-skill__value')]", default="")
                if skill_name:
                    skills.append({
                        "name": skill_name.strip(),
                        "modifier": skill_modifier.strip()
                    })
            except:
                continue

        # Extract proficiencies
        proficiencies = []
        prof_elements = tree.xpath("//div[contains(@class, 'ct-proficiency-groups__group-items')] | //div[contains(@class, 'ddbc-proficiency-groups')]")
        for prof_elem in prof_elements:
            try:
                items = prof_elem.xpath(".//span[contains(@class, 'ct-proficiency-groups__group-item')] | .//span[contains(@class, 'ddbc-proficiency')]")
                for item in items:
                    prof_text = item.text_content().strip()
                    if prof_text:
                        proficiencies.append(prof_text)
            except:
                continue

        # Extract features and traits
        features = []
        feature_elements = tree.xpath("//div[contains(@class, 'ct-feature-snippet')] | //div[contains(@class, 'ddbc-feature-snippet')]")
        for feat_elem in feature_elements:
            try:
                feat_name = get_text(".//span[contains(@class, 'ct-feature-snippet__heading')] | .//span[contains(@class, 'ddbc-feature-snippet__heading')]", default="")
                feat_desc = get_text(".//div[contains(@class, 'ct-feature-snippet__content')] | .//div[contains(@class, 'ddbc-feature-snippet__content')]", default="")
                if feat_name:
                    features.append({
                        "name": feat_name.strip(),
                        "description": feat_desc.strip() if feat_desc else ""
                    })
            except:
                continue

        # Extract feats specifically
        feats = []
        feat_elements = tree.xpath("//div[contains(@class, 'ct-feats__item')] | //div[contains(@class, 'ddbc-feat')]")
        for feat_elem in feat_elements:
            try:
                feat_name = get_text(".//span[contains(@class, 'ct-feats__item-name')] | .//span[contains(@class, 'ddbc-feat__name')]", default="")
                feat_desc = get_text(".//div[contains(@class, 'ct-feats__item-description')] | .//div[contains(@class, 'ddbc-feat__description')]", default="")
                if feat_name:
                    feats.append({
                        "name": feat_name.strip(),
                        "description": feat_desc.strip() if feat_desc else ""
                    })
            except:
                continue

        # Extract equipment
        equipment = []
        equip_elements = tree.xpath("//ul[contains(@class, 'ct-inventory__item')] | //ul[contains(@class, 'ddbc-inventory-item')]")
        for equip_elem in equip_elements:
            try:
                item_name = get_text(".//span[contains(@class, 'ct-item-name')] | .//span[contains(@class, 'ddbc-item-name')]", default="")
                item_qty = get_text(".//span[contains(@class, 'ct-item-quantity')] | .//span[contains(@class, 'ddbc-item-quantity')]", default="1")
                if item_name:
                    try:
                        qty = int(item_qty.strip())
                    except:
                        qty = 1
                    equipment.append({
                        "name": item_name.strip(),
                        "quantity": qty
                    })
            except:
                continue

        # Extract spells
        spells = []
        spell_elements = tree.xpath("//div[contains(@class, 'ct-spells__spell')] | //div[contains(@class, 'ddbc-spell')]")
        for spell_elem in spell_elements:
            try:
                spell_name = get_text(".//span[contains(@class, 'ct-spell-name')] | .//span[contains(@class, 'ddbc-spell-name')]", default="")
                spell_level = get_text(".//span[contains(@class, 'ct-spell-level')] | .//span[contains(@class, 'ddbc-spell-level')]", default="")
                spell_school = get_text(".//span[contains(@class, 'ct-spell-school')] | .//span[contains(@class, 'ddbc-spell-school')]", default="")
                if spell_name:
                    spells.append({
                        "name": spell_name.strip(),
                        "level": spell_level.strip() if spell_level else "0",
                        "school": spell_school.strip() if spell_school else ""
                    })
            except:
                continue

        # Extract spell slots
        spell_slots = {}
        for level_num in range(1, 10):
            slot_xpath = f"//div[contains(@class, 'ct-slots__level--{level_num}')] | //div[contains(@class, 'ddbc-spell-slot-level-{level_num}')]"
            slot_elements = tree.xpath(slot_xpath)
            if slot_elements:
                try:
                    total = get_text(f"{slot_xpath}//span[contains(@class, 'ct-slots__total')]", default="0")
                    used = get_text(f"{slot_xpath}//span[contains(@class, 'ct-slots__used')]", default="0")
                    spell_slots[f"level{level_num}"] = {
                        "total": int(total) if total.isdigit() else 0,
                        "used": int(used) if used.isdigit() else 0
                    }
                except:
                    continue

        # Build result
        character_data = {
            "characterName": character_name,
            "playerName": player_name if player_name else None,
            "race": race,
            "class": character_class,
            "level": level,
            "background": background if background else None,
            "imageUrl": image_url if image_url else None,
            "backstory": backstory if backstory else None,
            "abilityScores": ability_scores,
            "skills": skills if skills else [],
            "proficiencies": proficiencies if proficiencies else [],
            "proficiencyBonus": proficiency_bonus,
            "armorClass": armor_class,
            "hitPoints": {
                "current": current_hp,
                "max": max_hp,
                "temp": 0
            },
            "speed": speed,
            "features": features if features else [],
            "feats": feats if feats else [],
            "equipment": equipment if equipment else [],
            "spells": spells if spells else [],
            "spellSlots": spell_slots if spell_slots else {}
        }

        return character_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No URL provided",
            "usage": "python crawl_dndbeyond.py <url>"
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
