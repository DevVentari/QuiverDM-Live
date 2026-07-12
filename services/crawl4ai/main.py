"""
DnD Beyond character extractor using crawl4ai + Playwright.

Problem: The DDB character-service API returns 403 for private characters
even when the requester is the campaign DM. But the website renders those
same characters fine for authenticated DMs. This service renders the page
as the DM (using their CobaltSession cookie) and intercepts the XHR that
the DDB SPA makes to character-service.dndbeyond.com — giving us clean JSON
without HTML parsing.

Usage:
  POST /character/extract
    { "character_id": "12345678", "cobalt_session": "<cookie value>" }

  GET /health
"""

import asyncio
import json
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from playwright.async_api import async_playwright, Route, Request

app = FastAPI(title="DDB Character Extractor", version="1.0.0")


class ExtractRequest(BaseModel):
    character_id: str
    cobalt_session: str


class ExtractResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None


CHARACTER_URL = "https://www.dndbeyond.com/characters/{character_id}"
CAMPAIGN_URL = "https://www.dndbeyond.com/campaigns/{campaign_id}"
CHARACTER_API_RE = re.compile(
    r"https://character-service\.dndbeyond\.com/character/v\d+/character/\d+"
)
CAMPAIGN_CHARS_API_RE = re.compile(
    r"https://(?:www\.dndbeyond\.com|character-service\.dndbeyond\.com)/(?:api/)?(?:campaign|character)[^\s\"']*"
)
CHARACTER_ID_RE = re.compile(r"/characters/(\d+)")


async def extract_character(character_id: str, cobalt_session: str) -> dict:
    """
    Launch a headless Chromium browser with the DM's CobaltSession cookie,
    navigate to the DDB character page, and intercept the character-service
    XHR the page makes. Returns the raw character JSON.
    """
    intercepted: dict = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
            },
        )

        # Inject the DM's session cookie
        await context.add_cookies(
            [
                {
                    "name": "CobaltSession",
                    "value": cobalt_session,
                    "domain": ".dndbeyond.com",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                    "sameSite": "None",
                }
            ]
        )

        page = await context.new_page()
        captured_event = asyncio.Event()

        async def handle_response(response):
            if CHARACTER_API_RE.match(response.url) and not intercepted:
                try:
                    body = await response.json()
                    intercepted.update(body)
                    captured_event.set()
                except Exception:
                    pass

        page.on("response", handle_response)

        url = CHARACTER_URL.format(character_id=character_id)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Wait up to 15s for the character API response to be intercepted
        try:
            await asyncio.wait_for(captured_event.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            pass

        await browser.close()

    if not intercepted:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not intercept character data. "
                "The character may be truly private (not in your campaign), "
                "or the CobaltSession may be expired."
            ),
        )

    return intercepted


class CampaignExtractRequest(BaseModel):
    campaign_id: str
    cobalt_session: str


class CampaignCharacterCard(BaseModel):
    """One character card from the campaign page. The campaign roster shows
    name/class/player for EVERY character — including ones whose sheet is
    set to Private (privacy gates the sheet, not the roster)."""
    id: Optional[str] = None  # absent for private characters (no view link)
    name: str
    meta: Optional[str] = None  # e.g. "Lvl 12 | Human | Artificer / Wizard / School of Transmutation"
    player_username: Optional[str] = None


class CampaignExtractResponse(BaseModel):
    success: bool
    character_ids: list[str] = []
    characters: list[CampaignCharacterCard] = []
    message: Optional[str] = None


async def extract_campaign_characters(
    campaign_id: str, cobalt_session: str
) -> tuple[list[str], list[dict]]:
    """
    Navigate to the DDB campaign page as the DM and collect:
    1. Character IDs (XHR interception + /characters/{id} links)
    2. The rendered character CARDS (name, meta line, player) — the only
       source of names/classes for fully-private characters
    """
    intercepted_ids: set[str] = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        await context.add_cookies([{
            "name": "CobaltSession",
            "value": cobalt_session,
            "domain": ".dndbeyond.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "None",
        }])

        page = await context.new_page()

        async def handle_response(response):
            url = response.url
            if "character" in url and "dndbeyond.com" in url:
                try:
                    body = await response.text()
                    for m in CHARACTER_ID_RE.finditer(body):
                        intercepted_ids.add(m.group(1))
                    # Also check URL itself
                    for m in re.finditer(r"/character/v\d+/character/(\d+)", url):
                        intercepted_ids.add(m.group(1))
                except Exception:
                    pass

        page.on("response", handle_response)

        url = CAMPAIGN_URL.format(campaign_id=campaign_id)
        await page.goto(url, wait_until="networkidle", timeout=30000)

        # Also scrape rendered HTML for character links
        html = await page.content()
        for m in CHARACTER_ID_RE.finditer(html):
            intercepted_ids.add(m.group(1))

        # Scrape the character cards — names/classes/players render for every
        # character, even ones whose sheet is Private.
        cards_data: list[dict] = []
        try:
            cards = await page.query_selector_all(".ddb-campaigns-character-card")
            for card in cards:
                name_el = await card.query_selector(
                    ".ddb-campaigns-character-card-header-upper-character-info-primary"
                )
                if not name_el:
                    continue
                name = (await name_el.inner_text()).strip()
                if not name:
                    continue
                meta: Optional[str] = None
                player: Optional[str] = None
                for sec in await card.query_selector_all(
                    ".ddb-campaigns-character-card-header-upper-character-info-secondary"
                ):
                    text = " ".join((await sec.inner_text()).split())
                    if text.lower().startswith("player:"):
                        player = text.split(":", 1)[1].strip() or None
                    elif text:
                        meta = text
                card_id: Optional[str] = None
                link = await card.query_selector('a[href*="/characters/"]')
                if link:
                    href = await link.get_attribute("href") or ""
                    m = CHARACTER_ID_RE.search(href)
                    if m:
                        card_id = m.group(1)
                        intercepted_ids.add(card_id)
                cards_data.append(
                    {"id": card_id, "name": name, "meta": meta, "player_username": player}
                )
        except Exception:
            # Card markup changed — IDs still flow through the legacy path.
            pass

        await browser.close()

    return list(intercepted_ids), cards_data


@app.post("/campaign/extract", response_model=CampaignExtractResponse)
async def extract_campaign_endpoint(req: CampaignExtractRequest):
    try:
        ids, cards = await extract_campaign_characters(req.campaign_id, req.cobalt_session)
        if not ids and not cards:
            return CampaignExtractResponse(
                success=False,
                message="No characters found. Session may be expired or campaign may be private.",
            )
        return CampaignExtractResponse(
            success=True,
            character_ids=ids,
            characters=[CampaignCharacterCard(**c) for c in cards],
        )
    except Exception as e:
        return CampaignExtractResponse(success=False, message=str(e))


@app.post("/character/extract", response_model=ExtractResponse)
async def extract_character_endpoint(req: ExtractRequest):
    try:
        data = await extract_character(req.character_id, req.cobalt_session)
        return ExtractResponse(success=True, data=data)
    except HTTPException as e:
        return ExtractResponse(success=False, message=e.detail)
    except Exception as e:
        return ExtractResponse(success=False, message=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
